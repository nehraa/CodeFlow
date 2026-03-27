import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getNodeRuntimeExport, getNodeStubPath } from "@/lib/blueprint/codegen";
import type { BlueprintGraph, BlueprintNode } from "@/lib/blueprint/schema";
import {
  compileTypeScriptWorkspace,
  initializeTypeScriptWorkspace,
  writeBlueprintGraphToWorkspace,
  writeWorkspaceFile,
  type WorkspaceCompileResult
} from "@/lib/blueprint/typescript-workspace";
import { runCommand } from "@/lib/server/run-command";

const RUNTIME_HARNESS_PATH = "runtime-executor.mjs";

type RuntimeHarnessPayload = {
  nodeId: string;
  kind: BlueprintNode["kind"];
  exportName: string;
  modulePath: string;
  input: unknown;
  args: unknown[];
  methodName?: string;
};

export type RuntimeNodeInvocationResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  executedPath: string;
  output?: unknown;
  error?: string;
  methodName?: string;
};

export type PreparedRuntimeWorkspace = {
  workspaceDir: string;
  compileResult: WorkspaceCompileResult;
  invokeNode: (
    node: BlueprintNode,
    input: unknown,
    args: unknown[]
  ) => Promise<RuntimeNodeInvocationResult>;
  cleanup: () => Promise<void>;
};

const buildRuntimeHarness = (): string => `
import fs from "node:fs/promises";
import { inspect } from "node:util";
import { pathToFileURL } from "node:url";

const payload = JSON.parse(process.env.CODEFLOW_RUNTIME_PAYLOAD ?? "{}");
const resultPath = process.env.CODEFLOW_RUNTIME_RESULT_PATH;

const writeResult = async (value) => {
  if (!resultPath) {
    return;
  }

  await fs.writeFile(resultPath, JSON.stringify(value, null, 2), "utf8");
};

try {
  const runtimeModule = await import(pathToFileURL(payload.modulePath).href);
  let output;

  if (payload.kind === "class") {
    const ClassRef = runtimeModule[payload.exportName];
    if (typeof ClassRef !== "function") {
      throw new Error(\`Export \${payload.exportName} is not a class constructor.\`);
    }

    const instance = new ClassRef();
    const callable = instance[payload.methodName];
    if (typeof callable !== "function") {
      throw new Error(\`Method \${payload.methodName ?? "unknown"} is not callable on \${payload.exportName}.\`);
    }

    output = await callable.apply(instance, payload.args);
  } else if (payload.kind === "api") {
    const callable = runtimeModule[payload.exportName];
    if (typeof callable !== "function") {
      throw new Error(\`Export \${payload.exportName} is not callable.\`);
    }

    const request = new Request(\`http://localhost/\${payload.nodeId}\`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload.input ?? null)
    });
    const response = await callable(request);
    const text = await response.text();
    let body = text;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    output = {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body,
      rawText: text
    };
  } else {
    const callable = runtimeModule[payload.exportName];
    if (typeof callable !== "function") {
      throw new Error(\`Export \${payload.exportName} is not callable.\`);
    }

    output = await callable(...payload.args);
  }

  await writeResult({ ok: true, output });
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown runtime error.";
  const stack = error instanceof Error ? error.stack : undefined;

  await writeResult({
    ok: false,
    error: {
      message,
      stack,
      preview: inspect(error, { depth: 4 })
    }
  });

  console.error(message);
  if (stack) {
    console.error(stack);
  }
  process.exitCode = 1;
}
`;

const readInvocationResult = async (
  resultPath: string
): Promise<{ ok: boolean; output?: unknown; error?: { message?: string; stack?: string; preview?: string } } | null> => {
  try {
    const content = await fs.readFile(resultPath, "utf8");
    return JSON.parse(content) as {
      ok: boolean;
      output?: unknown;
      error?: { message?: string; stack?: string; preview?: string };
    };
  } catch {
    return null;
  }
};

const createHarnessPayload = (
  workspaceDir: string,
  node: BlueprintNode,
  input: unknown,
  args: unknown[]
): RuntimeHarnessPayload => {
  const exportName = getNodeRuntimeExport(node);
  const stubPath = getNodeStubPath(node);

  if (!exportName || !stubPath) {
    throw new Error(`Node ${node.name} does not expose a runtime entrypoint.`);
  }

  return {
    nodeId: node.id,
    kind: node.kind,
    exportName,
    modulePath: path.join(workspaceDir, "dist", stubPath.replace(/\.(ts|tsx)$/, ".js")),
    input,
    args,
    methodName: node.kind === "class" ? node.contract.methods[0]?.name : undefined
  };
};

export const prepareRuntimeWorkspace = async ({
  graph,
  codeDrafts
}: {
  graph: BlueprintGraph;
  codeDrafts?: Record<string, string>;
}): Promise<PreparedRuntimeWorkspace> => {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-run-"));

  await initializeTypeScriptWorkspace(workspaceDir, graph);
  await writeBlueprintGraphToWorkspace(workspaceDir, graph, codeDrafts);
  await writeWorkspaceFile(workspaceDir, RUNTIME_HARNESS_PATH, buildRuntimeHarness());

  const compileResult = compileTypeScriptWorkspace(workspaceDir);

  return {
    workspaceDir,
    compileResult,
    invokeNode: async (node, input, args) => {
      const startedAt = Date.now();
      const payload = createHarnessPayload(workspaceDir, node, input, args);
      const resultPath = path.join(workspaceDir, `runtime-result-${node.id.replace(/[^A-Za-z0-9_-]+/g, "-")}.json`);

      const runResult = await runCommand(process.execPath, [RUNTIME_HARNESS_PATH], {
        cwd: workspaceDir,
        timeoutMs: 20_000,
        stdoutMaxBytes: 64 * 1024,
        stderrMaxBytes: 128 * 1024,
        env: {
          ...process.env,
          NO_COLOR: "1",
          CODEFLOW_RUNTIME_PAYLOAD: JSON.stringify(payload),
          CODEFLOW_RUNTIME_RESULT_PATH: resultPath
        }
      });

      const harnessResult = await readInvocationResult(resultPath);
      const error =
        runResult.exitCode === 0
          ? undefined
          : harnessResult?.error?.message ?? "Runtime execution failed.";

      return {
        success: runResult.exitCode === 0 && harnessResult?.ok !== false,
        stdout: runResult.stdout,
        stderr: [runResult.stderr, harnessResult?.error?.stack, harnessResult?.error?.preview]
          .filter(Boolean)
          .join("\n")
          .trim(),
        exitCode: runResult.exitCode,
        durationMs: Date.now() - startedAt,
        executedPath: payload.modulePath,
        output: harnessResult?.output,
        error,
        methodName: payload.methodName
      };
    },
    cleanup: async () => {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
};
