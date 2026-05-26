/**
 * TypeScript workspace management for runtime execution.
 * Copied from monorepo src/lib/blueprint/typescript-workspace.ts
 * to keep codeflow-execution standalone.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNodeStubPath, getNodeDocPath, getNodeRuntimeExport } from "../utils.js";
import { runCommand } from "./run-command.js";
const WORKSPACE_FILES = [
    "tsconfig.json",
    "package.json"
];
const BASE_TSCONFIG = {
    compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        allowJs: false,
        noEmit: false
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
};
const BASE_PACKAGE_JSON = {
    type: "module",
    name: "codeflow-runtime-workspace",
    version: "1.0.0",
    private: true,
    main: "dist/index.js",
    dependencies: {},
    devDependencies: {
        "@types/node": "^22.0.0",
        "typescript": "^5.7.0"
    },
    scripts: {
        "build": "tsc",
        "typecheck": "tsc --noEmit"
    }
};
const writeJsonFile = async (filePath, data) => {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};
export const initializeTypeScriptWorkspace = async (workspaceDir, _graph) => {
    const srcDir = path.join(workspaceDir, "src");
    const stubsDir = path.join(srcDir, "stubs");
    const docsDir = path.join(srcDir, "docs");
    await fs.mkdir(stubsDir, { recursive: true });
    await fs.mkdir(docsDir, { recursive: true });
    await writeJsonFile(path.join(workspaceDir, "tsconfig.json"), BASE_TSCONFIG);
    await writeJsonFile(path.join(workspaceDir, "package.json"), BASE_PACKAGE_JSON);
};
export const writeWorkspaceFile = async (workspaceDir, filePath, content) => {
    const fullPath = path.join(workspaceDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
};
const getStubContent = (node) => {
    const exportName = (getNodeRuntimeExport(node) ?? node.name.replace(/[^A-Za-z0-9_$]+/g, "_").replace(/^_|_$/g, "")) || "generatedNode";
    const returnType = node.kind === "class"
        ? node.contract.methods?.[0]?.outputs?.[0]?.type || "void"
        : node.contract.outputs?.[0]?.type || "void";
    return `// Scaffold stub for ${node.id}
export function ${exportName}(...args: unknown[]): ${returnType} {
  throw new Error("CodeFlow scaffold: implementation required for ${node.id}");
}
`;
};
export const writeBlueprintGraphToWorkspace = async (workspaceDir, graph, _codeDrafts) => {
    const srcStubsDir = path.join(workspaceDir, "src", "stubs");
    const srcDocsDir = path.join(workspaceDir, "src", "docs");
    await fs.mkdir(srcStubsDir, { recursive: true });
    await fs.mkdir(srcDocsDir, { recursive: true });
    // Write stub files for each code-bearing node
    for (const node of graph.nodes) {
        if (node.kind === "module") {
            continue;
        }
        const stubPath = getNodeStubPath(node);
        if (!stubPath) {
            continue;
        }
        // Write stubs to src/stubs/ so tsc can find and compile them to dist/stubs/
        const srcStubPath = path.join("src", stubPath);
        const fullStubPath = path.join(workspaceDir, srcStubPath);
        await fs.mkdir(path.dirname(fullStubPath), { recursive: true });
        await fs.writeFile(fullStubPath, getStubContent(node), "utf8");
    }
    // Write docs for each node
    for (const node of graph.nodes) {
        const docPath = getNodeDocPath(node);
        const fullDocPath = path.join(workspaceDir, "src", docPath);
        await fs.mkdir(path.dirname(fullDocPath), { recursive: true });
        const inputs = node.contract.inputs.map((f) => `  - ${f.name}: ${f.type}`).join("\n");
        const outputs = node.contract.outputs.map((f) => `  - ${f.name}: ${f.type}`).join("\n");
        const content = `# ${node.name}\n\n${node.summary}\n\n## Contract\n\n### Inputs\n${inputs || "  (none)"}\n\n### Outputs\n${outputs || "  (none)"}\n`;
        await fs.writeFile(fullDocPath, content, "utf8");
    }
    // Write graph metadata
    await writeJsonFile(path.join(workspaceDir, "src", "graph-meta.json"), {
        projectName: graph.projectName,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length
    });
};
export const compileTypeScriptWorkspace = async (workspaceDir) => {
    // Resolve TypeScript from this package's node_modules, not workspace's
    // Use import.meta.resolve which is available in Node.js ESM
    const tsUrl = import.meta.resolve("typescript/lib/tsc.js");
    const tsPath = fileURLToPath(tsUrl);
    const result = await runCommand(process.execPath, [tsPath, "--project", workspaceDir], { cwd: workspaceDir, timeoutMs: 60_000 });
    return {
        success: result.exitCode === 0,
        diagnostics: result.stdout + result.stderr,
        issues: []
    };
};
