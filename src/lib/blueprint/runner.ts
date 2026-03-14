import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exec } from "tinyexec";

import {
  generateNodeCode,
  getNodeRuntimeExport,
  getNodeStubPath,
  isCodeBearingNode
} from "@/lib/blueprint/codegen";
import { getCodeBearingNodes, getDefaultExecutionTarget } from "@/lib/blueprint/phases";
import type {
  BlueprintGraph,
  BlueprintNode,
  RuntimeExecutionRequest,
  RuntimeExecutionResult
} from "@/lib/blueprint/schema";

const writeWorkspaceFile = async (
  workspaceDir: string,
  relativePath: string,
  content: string
): Promise<void> => {
  const targetPath = path.join(workspaceDir, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
};

const getNodeSource = (
  node: BlueprintNode,
  graph: BlueprintGraph,
  codeDrafts?: Record<string, string>
): string | null =>
  codeDrafts?.[node.id] ?? node.implementationDraft ?? node.specDraft ?? generateNodeCode(node, graph);

const normalizeRelativeImports = (source: string): string =>
  source.replace(
    /(from\s+["'])(\.{1,2}\/[^"'.]+)(["'])/g,
    (_, prefix: string, importPath: string, suffix: string) => `${prefix}${importPath}.js${suffix}`
  );

const escapeForTemplateLiteral = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const createRuntimeHarness = (
  node: BlueprintNode,
  relativeImportPath: string,
  inputLiteral: string
): string => {
  const exportedName = getNodeRuntimeExport(node);

  if (!exportedName) {
    throw new Error(`Node ${node.name} (${node.kind}) is not runnable in the current execution runner.`);
  }

  if (node.kind === "function") {
    return `
import { ${exportedName} } from "${relativeImportPath}";

const rawInput = ${inputLiteral};
const parsedInput = (() => {
  try {
    return JSON.parse(rawInput);
  } catch {
    return rawInput;
  }
})();

const invoke = ${exportedName} as (...args: any[]) => any;
const args = Array.isArray(parsedInput) ? (parsedInput as any[]) : [parsedInput];
const result = await invoke(...args);
if (typeof result !== "undefined") {
  console.log(JSON.stringify(result, null, 2));
}
`;
  }

  if (node.kind === "api") {
    return `
import { ${exportedName} } from "${relativeImportPath}";

const rawInput = ${inputLiteral};
const parsedBody = (() => {
  try {
    return JSON.parse(rawInput);
  } catch {
    return rawInput;
  }
})();

const request = new Request("http://localhost/${node.id}", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(parsedBody)
});

const response = await ${exportedName}(request);
const text = await response.text();
console.log(text);
`;
  }

  if (node.kind === "class") {
    const methodName = node.contract.methods[0]?.name;
    if (!methodName) {
      throw new Error(`Class node ${node.name} has no callable methods defined in its contract.`);
    }

    return `
import { ${exportedName} } from "${relativeImportPath}";

const rawInput = ${inputLiteral};
const parsedInput = (() => {
  try {
    return JSON.parse(rawInput);
  } catch {
    return rawInput;
  }
})();

const instance = new ${exportedName}();
const invoke = instance.${methodName} as (...args: any[]) => any;
const args = Array.isArray(parsedInput) ? (parsedInput as any[]) : [parsedInput];
const result = await invoke(...args);
if (typeof result !== "undefined") {
  console.log(JSON.stringify(result, null, 2));
}
`;
  }

  throw new Error(`Node ${node.name} (${node.kind}) is not runnable in the current execution runner.`);
};

const createIntegrationHarness = (
  targetNode: BlueprintNode,
  inputLiteral: string,
  integrationImports: Array<{ importPath: string; binding: string }>
): string => {
  const rootExport = getNodeRuntimeExport(targetNode);
  if (!rootExport) {
    throw new Error(`Node ${targetNode.name} (${targetNode.kind}) cannot act as an integration entrypoint.`);
  }

  const importLines = integrationImports
    .filter(({ binding }) => binding !== "integrationRoot")
    .map(
      ({ importPath, binding }) =>
        `import * as ${binding} from "${importPath}";\nvoid ${binding};`
    )
    .join("\n");

  const rootImportPath = integrationImports.find((entry) => entry.binding === "integrationRoot")?.importPath;
  if (!rootImportPath) {
    throw new Error("Integration root import could not be resolved.");
  }

  return `
import * as integrationRoot from "${rootImportPath}";
${importLines}

const rawInput = ${inputLiteral};
const parsedInput = (() => {
  try {
    return JSON.parse(rawInput);
  } catch {
    return rawInput;
  }
})();

const candidate = integrationRoot["${rootExport}"] as ((...args: any[]) => any) | undefined;
if (typeof candidate !== "function") {
  throw new Error("Integration root export is not callable.");
}

const args = Array.isArray(parsedInput) ? (parsedInput as any[]) : [parsedInput];
const result = await candidate(...args);
if (typeof result !== "undefined") {
  console.log(JSON.stringify(result, null, 2));
}
`;
};

const resolveTargetNode = (
  graph: BlueprintGraph,
  request: RuntimeExecutionRequest
): BlueprintNode => {
  if (request.targetNodeId) {
    const explicitTarget = graph.nodes.find((node) => node.id === request.targetNodeId);
    if (!explicitTarget) {
      throw new Error(`Node ${request.targetNodeId} was not found.`);
    }
    return explicitTarget;
  }

  const defaultTarget = getDefaultExecutionTarget(graph);
  if (!defaultTarget) {
    throw new Error("No runnable node could be selected for integration execution.");
  }

  return defaultTarget;
};

export const runBlueprint = async (
  request: RuntimeExecutionRequest
): Promise<RuntimeExecutionResult & { executedNodeId: string }> => {
  const startedAt = Date.now();
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-run-"));

  try {
    const targetNode = resolveTargetNode(request.graph, request);
    if (!isCodeBearingNode(targetNode)) {
      throw new Error(`Node ${targetNode.name} is architectural only and cannot be executed.`);
    }

    await writeWorkspaceFile(
      workspaceDir,
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            lib: ["ES2022", "DOM"],
            outDir: "dist",
            rootDir: ".",
            strict: false,
            esModuleInterop: true,
            skipLibCheck: true,
            jsx: "react-jsx"
          },
          include: ["entrypoint.ts", "stubs/**/*.ts", "stubs/**/*.tsx"]
        },
        null,
        2
      )
    );

    await writeWorkspaceFile(
      workspaceDir,
      "package.json",
      JSON.stringify({ name: "codeflow-runner", private: true, type: "module" }, null, 2)
    );

    for (const node of request.graph.nodes) {
      const stubPath = getNodeStubPath(node);
      const content = stubPath ? getNodeSource(node, request.graph, request.codeDrafts) : null;
      if (!stubPath || !content) {
        continue;
      }

      await writeWorkspaceFile(workspaceDir, stubPath, normalizeRelativeImports(content));
    }

    const targetStubPath = getNodeStubPath(targetNode);
    if (!targetStubPath) {
      throw new Error(`Node ${targetNode.name} does not have an executable artifact path.`);
    }

    const inputLiteral = `\`${escapeForTemplateLiteral(request.input)}\``;
    const entrypointSource = request.targetNodeId
      ? createRuntimeHarness(targetNode, `./${targetStubPath.replace(/\.(ts|tsx)$/, ".js")}`, inputLiteral)
      : createIntegrationHarness(
          targetNode,
          inputLiteral,
          getCodeBearingNodes(request.graph).map((node, index) => {
            const stubPath = getNodeStubPath(node);
            if (!stubPath) {
              throw new Error(`Node ${node.name} does not have an integration artifact path.`);
            }

            return {
              importPath: `./${stubPath.replace(/\.(ts|tsx)$/, ".js")}`,
              binding: node.id === targetNode.id ? "integrationRoot" : `integrationNode${index + 1}`
            };
          })
        );
    await writeWorkspaceFile(workspaceDir, "entrypoint.ts", entrypointSource);

    const tscPath = path.resolve(process.cwd(), "node_modules/typescript/bin/tsc");
    const compileResult = await exec(tscPath, [], { nodeOptions: { cwd: workspaceDir } });

    if (compileResult.exitCode !== 0) {
      return {
        success: false,
        stdout: compileResult.stdout,
        stderr: compileResult.stderr,
        exitCode: compileResult.exitCode ?? null,
        durationMs: Date.now() - startedAt,
        executedPath: path.join(workspaceDir, "entrypoint.ts"),
        error: "TypeScript compilation failed.",
        executedNodeId: targetNode.id
      };
    }

    const runResult = await exec(process.execPath, [path.join("dist", "entrypoint.js")], {
      nodeOptions: { cwd: workspaceDir }
    });

    return {
      success: runResult.exitCode === 0,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode ?? null,
      durationMs: Date.now() - startedAt,
      executedPath: path.join(workspaceDir, "dist", "entrypoint.js"),
      error: runResult.exitCode === 0 ? undefined : "Runtime execution failed.",
      executedNodeId: targetNode.id
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown execution error.",
      exitCode: 1,
      durationMs: Date.now() - startedAt,
      executedPath: path.join(workspaceDir, "entrypoint.ts"),
      error: error instanceof Error ? error.message : "Unknown execution error.",
      executedNodeId: request.targetNodeId ?? ""
    };
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
