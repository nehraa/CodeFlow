import fs from "node:fs/promises";
import path from "node:path";
import { emptyContract } from "../schema/index.js";
import { createNode, dedupeEdges, mergeContracts, toPosixPath } from "../internal/utils.js";
import { SUPPORTED_EXTENSIONS } from "./tree-sitter-loader.js";
import { extractNodesFromFile } from "./tree-sitter-analyzer.js";
const DEFAULT_EXCLUDE_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    "__pycache__",
    "vendor",
    ".venv"
]);
const SOURCE_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx",
    ".go", ".py",
    ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
    ".rs"
]);
const walkDirectory = async (dir, excludeDirs) => {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (excludeDirs.has(entry.name))
                continue;
            files.push(...await walkDirectory(fullPath, excludeDirs));
        }
        else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (SOURCE_EXTENSIONS.has(ext)) {
                files.push(fullPath);
            }
        }
    }
    return files;
};
export const analyzeRepo = async (repoPath, options) => {
    const repoStat = await fs.stat(repoPath).catch(() => null);
    if (!repoStat?.isDirectory()) {
        throw new Error(`Repo path does not exist or is not a directory: ${repoPath}`);
    }
    const excludeDirs = new Set(DEFAULT_EXCLUDE_DIRS);
    if (options?.excludePatterns) {
        for (const p of options.excludePatterns)
            excludeDirs.add(p);
    }
    const files = await walkDirectory(repoPath, excludeDirs);
    const warnings = [];
    if (files.length === 0) {
        warnings.push(`No supported source files found under ${repoPath}. Supported: ${[...SOURCE_EXTENSIONS].join(", ")}`);
    }
    const allNodes = [];
    const allSymbolIndex = new Map();
    const allCallEdges = [];
    const allImportEdges = [];
    const allInheritEdges = [];
    for (const filePath of files) {
        const relativePath = toPosixPath(path.relative(repoPath, filePath));
        const result = await extractNodesFromFile(filePath, relativePath);
        allNodes.push(...result.nodes);
        for (const [key, id] of result.symbolIndex) {
            allSymbolIndex.set(key, id);
        }
        allCallEdges.push(...result.callEdges);
        allImportEdges.push(...result.importEdges);
        allInheritEdges.push(...result.inheritEdges);
    }
    const nodeMap = new Map();
    for (const n of allNodes) {
        nodeMap.set(n.nodeId, createNode({
            id: n.nodeId,
            kind: n.kind,
            name: n.name,
            summary: n.summary,
            path: n.path,
            ownerId: n.ownerId,
            signature: n.signature || undefined,
            contract: mergeContracts(emptyContract(), {
                ...emptyContract(),
                summary: n.summary,
                responsibilities: [n.summary]
            }),
            sourceRefs: n.sourceRefs
        }));
    }
    const edges = [];
    // Build module lookup map for O(1) import resolution
    const moduleLookup = new Map();
    for (const node of nodeMap.values()) {
        if (node.kind !== "module" || node.path == null)
            continue;
        const normalizedPath = toPosixPath(node.path);
        const pathWithoutExtension = normalizedPath.slice(0, normalizedPath.length - path.extname(normalizedPath).length);
        const basenameWithoutExtension = path.posix.basename(pathWithoutExtension);
        // Map exact path
        if (!moduleLookup.has(normalizedPath)) {
            moduleLookup.set(normalizedPath, node);
        }
        // Map path without extension
        if (!moduleLookup.has(pathWithoutExtension)) {
            moduleLookup.set(pathWithoutExtension, node);
        }
        // Map basename without extension
        if (!moduleLookup.has(basenameWithoutExtension)) {
            moduleLookup.set(basenameWithoutExtension, node);
        }
    }
    // Helper to build deterministic import candidate paths
    const buildImportCandidatePaths = (fromModulePath, importPath) => {
        const normalizedImportPath = toPosixPath(importPath);
        const importerDir = path.posix.dirname(toPosixPath(fromModulePath));
        const isRelativeImport = normalizedImportPath.startsWith("./") || normalizedImportPath.startsWith("../");
        const basePath = isRelativeImport
            ? path.posix.normalize(path.posix.join(importerDir, normalizedImportPath))
            : path.posix.normalize(normalizedImportPath.replace(/^\/+/, ""));
        const candidates = new Set();
        const importExt = path.posix.extname(basePath);
        // If import already has extension, use it directly
        if (importExt) {
            candidates.add(basePath);
            return candidates;
        }
        // Try all supported extensions
        for (const ext of SUPPORTED_EXTENSIONS) {
            candidates.add(`${basePath}${ext}`);
            candidates.add(path.posix.join(basePath, `index${ext}`));
        }
        return candidates;
    };
    // Match import edges to module nodes using deterministic path resolution
    for (const imp of allImportEdges) {
        const sourceModule = nodeMap.get(imp.fromModuleId);
        if (sourceModule?.kind !== "module" || sourceModule.path == null) {
            continue;
        }
        const candidatePaths = buildImportCandidatePaths(sourceModule.path, imp.importPath);
        let targetModule = [...nodeMap.values()].find(n => n.kind === "module" && n.path != null && candidatePaths.has(toPosixPath(n.path)));
        // Fallback: try module lookup map
        if (!targetModule) {
            const normalizedImport = imp.importPath.replace(/^\.\//, "").replace(/\.js$/, "");
            targetModule = moduleLookup.get(normalizedImport);
        }
        if (targetModule) {
            edges.push({
                from: imp.fromModuleId,
                to: targetModule.id,
                kind: "imports",
                label: imp.importPath,
                required: true,
                confidence: 0.9
            });
        }
    }
    for (const inh of allInheritEdges) {
        // Get child node to extract its path
        const childNode = nodeMap.get(inh.fromId);
        if (!childNode || childNode.path == null) {
            continue;
        }
        // Try exact match in same file first
        let parentNodeId = allSymbolIndex.get(`${childNode.path}::${inh.toName}`);
        // Fallback: search across all files
        if (!parentNodeId) {
            parentNodeId = [...allSymbolIndex.entries()].find(([key]) => key.endsWith(`::${inh.toName}`))?.[1];
        }
        if (parentNodeId) {
            edges.push({
                from: inh.fromId,
                to: parentNodeId,
                kind: "inherits",
                required: true,
                confidence: 0.95
            });
        }
    }
    for (const call of allCallEdges) {
        const targetId = [...allSymbolIndex.entries()].find(([key]) => key.endsWith(`::${call.toName}`))?.[1];
        if (targetId && targetId !== call.fromId) {
            edges.push({
                from: call.fromId,
                to: targetId,
                kind: "calls",
                label: call.callText,
                required: true,
                confidence: 0.85
            });
            const caller = nodeMap.get(call.fromId);
            const target = nodeMap.get(targetId);
            if (caller && target) {
                nodeMap.set(call.fromId, {
                    ...caller,
                    contract: mergeContracts(caller.contract, {
                        ...emptyContract(),
                        calls: [{ target: target.name, kind: "calls", description: call.callText }],
                        dependencies: [target.name]
                    })
                });
            }
        }
    }
    // Post-process: link Go methods (extracted as standalone functions) to their struct types
    for (const node of nodeMap.values()) {
        if (node.kind === "function" && node.name.includes(".") && !node.ownerId) {
            const [ownerName] = node.name.split(".");
            const classNode = [...nodeMap.values()].find(c => c.kind === "class" && c.name === ownerName);
            if (classNode) {
                nodeMap.set(node.id, { ...node, ownerId: classNode.id });
            }
        }
    }
    // Post-process: aggregate methods into their owner class's contract
    for (const node of nodeMap.values()) {
        if (node.kind !== "function" || !node.ownerId)
            continue;
        const ownerNode = nodeMap.get(node.ownerId);
        if (!ownerNode || ownerNode.kind !== "class")
            continue;
        const methodSpec = {
            name: node.name.split(".").pop() || node.name,
            signature: node.signature || undefined,
            summary: node.summary,
            inputs: node.contract.inputs,
            outputs: node.contract.outputs,
            sideEffects: node.contract.sideEffects,
            calls: node.contract.calls
        };
        nodeMap.set(ownerNode.id, {
            ...ownerNode,
            contract: {
                ...ownerNode.contract,
                methods: [...ownerNode.contract.methods, methodSpec]
            }
        });
    }
    return {
        nodes: [...nodeMap.values()],
        edges: dedupeEdges(edges),
        workflows: [],
        warnings
    };
};
