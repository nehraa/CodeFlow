import fs from "node:fs/promises";
import path from "node:path";

import type { BlueprintGraph, ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";
import { observabilityPath } from "../shared/utils.js";

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeSnapshotFile = async (
  projectName: string,
  snapshot: ObservabilitySnapshot
): Promise<void> => {
  const filePath = observabilityPath(projectName);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
};

export const loadObservabilitySnapshot = async (
  projectName: string
): Promise<ObservabilitySnapshot | null> => {
  try {
    const content = await fs.readFile(observabilityPath(projectName), "utf8");
    return JSON.parse(content) as ObservabilitySnapshot;
  } catch {
    return null;
  }
};

export const mergeObservabilitySnapshot = async ({
  projectName,
  spans,
  logs,
  graph
}: {
  projectName: string;
  spans: ObservabilitySnapshot["spans"];
  logs: ObservabilitySnapshot["logs"];
  graph?: BlueprintGraph;
}): Promise<ObservabilitySnapshot> => {
  const existing = await loadObservabilitySnapshot(projectName);
  const snapshot: ObservabilitySnapshot = {
    projectName,
    updatedAt: new Date().toISOString(),
    spans: [...(existing?.spans ?? []), ...spans].slice(-500),
    logs: [...(existing?.logs ?? []), ...logs].slice(-500),
    graph: graph ? blueprintGraphSchema.parse(graph) : existing?.graph
  };

  await writeSnapshotFile(projectName, snapshot);
  return snapshot;
};
