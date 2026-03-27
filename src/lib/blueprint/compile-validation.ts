import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import {
  compileTypeScriptWorkspace,
  initializeTypeScriptWorkspace,
  writeBlueprintGraphToWorkspace
} from "@/lib/blueprint/typescript-workspace";
import type { BlueprintGraph } from "@/lib/blueprint/schema";

export type NodeImplementationValidationResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  validatedPath: string;
  durationMs: number;
};

export const validateNodeImplementation = async ({
  graph,
  nodeId,
  code
}: {
  graph: BlueprintGraph;
  nodeId: string;
  code: string;
}): Promise<NodeImplementationValidationResult> => {
  const startedAt = Date.now();
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-validate-"));

  try {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new Error(`Blueprint node ${nodeId} was not found.`);
    }
    if (!isCodeBearingNode(node)) {
      throw new Error(`Blueprint node ${node.name} is architectural only and cannot be validated.`);
    }

    const targetPath = getNodeStubPath(node);
    if (!targetPath) {
      throw new Error(`Blueprint node ${node.name} does not map to a code artifact path.`);
    }

    await initializeTypeScriptWorkspace(workspaceDir, graph);
    await writeBlueprintGraphToWorkspace(workspaceDir, graph, undefined, {
      [nodeId]: code
    });

    const compileResult = compileTypeScriptWorkspace(workspaceDir, { noEmit: true });

    return {
      success: compileResult.success,
      stdout: "",
      stderr: compileResult.diagnostics,
      validatedPath: path.join(workspaceDir, targetPath),
      durationMs: Date.now() - startedAt
    };
  } finally {
    await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
  }
};
