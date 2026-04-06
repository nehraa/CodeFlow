import fs from "node:fs/promises";
import path from "node:path";

import type {
  BlueprintEdge,
  BlueprintNode
} from "../schema/index.js";
import { emptyContract } from "../schema/index.js";
import { createNode, createNodeId, dedupeEdges, mergeContracts, toPosixPath } from "../internal/utils.js";

import type { SupportedLanguage } from "./tree-sitter-loader.js";
import { SUPPORTED_EXTENSIONS, extensionToLanguage } from "./tree-sitter-loader.js";
import { extractNodesFromFile } from "./tree-sitter-analyzer.js";

type RepoGraphPart = Omit<import("../schema/index.js").BlueprintGraph, "projectName" | "mode" | "generatedAt">;

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

export interface AnalyzeRepoOptions {
  excludePatterns?: string[];
}

const walkDirectory = async (
  dir: string,
  excludeDirs: Set<string>
): Promise<string[]> => {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      files.push(...await walkDirectory(fullPath, excludeDirs));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
};

export const analyzeRepo = async (
  repoPath: string,
  options?: AnalyzeRepoOptions
): Promise<RepoGraphPart> => {
  const repoStat = await fs.stat(repoPath).catch(() => null);
  if (!repoStat?.isDirectory()) {
    throw new Error(`Repo path does not exist or is not a directory: ${repoPath}`);
  }

  const excludeDirs = new Set(DEFAULT_EXCLUDE_DIRS);
  if (options?.excludePatterns) {
    for (const p of options.excludePatterns) excludeDirs.add(p);
  }

  const files = await walkDirectory(repoPath, excludeDirs);
  const warnings: string[] = [];

  if (files.length === 0) {
    warnings.push(`No supported source files found under ${repoPath}. Supported: ${[...SOURCE_EXTENSIONS].join(", ")}`);
  }

  const allNodes: Array<{ nodeId: string; kind: string; name: string; summary: string; path: string; signature: string; sourceRefs: Array<{ kind: "repo"; path: string; symbol?: string }>; ownerId?: string }> = [];
  const allSymbolIndex = new Map<string, string>();
  const allCallEdges: Array<{ fromId: string; toName: string; callText: string }> = [];
  const allImportEdges: Array<{ fromModuleId: string; importPath: string }> = [];
  const allInheritEdges: Array<{ fromId: string; toName: string }> = [];

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

  const nodeMap = new Map<string, BlueprintNode>();
  for (const n of allNodes) {
    nodeMap.set(n.nodeId, createNode({
      id: n.nodeId,
      kind: n.kind as BlueprintNode["kind"],
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

  const edges: BlueprintEdge[] = [];

  for (const imp of allImportEdges) {
    const targetModule = [...nodeMap.values()].find(
      n => n.kind === "module" && n.path != null && (n.path.endsWith(imp.importPath) || n.path.includes(imp.importPath))
    );
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
    const parentNodeId = [...allSymbolIndex.entries()].find(
      ([key]) => key.endsWith(`::${inh.toName}`)
    )?.[1];
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
    const targetId = [...allSymbolIndex.entries()].find(
      ([key]) => key.endsWith(`::${call.toName}`)
    )?.[1];
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
            calls: [{ target: target.name, kind: "calls" as const, description: call.callText }],
            dependencies: [target.name]
          })
        });
      }
    }
  }

  for (const node of nodeMap.values()) {
    if (node.kind === "class" && node.ownerId) {
      const classNode = nodeMap.get(node.ownerId);
      if (classNode) {
        const methodSpec = {
          name: node.name.split(".").pop() || node.name,
          signature: node.signature,
          summary: node.summary,
          inputs: node.contract.inputs,
          outputs: node.contract.outputs,
          sideEffects: node.contract.sideEffects,
          calls: node.contract.calls
        };
        nodeMap.set(node.ownerId, {
          ...classNode,
          contract: {
            ...classNode.contract,
            methods: [...classNode.contract.methods, methodSpec]
          }
        });
      }
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: dedupeEdges(edges),
    workflows: [],
    warnings
  };
};
