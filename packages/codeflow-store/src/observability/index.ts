import fs from "node:fs/promises";
import path from "node:path";

import type { BlueprintGraph, ObservabilitySnapshot } from "@abhinav2203/codeflow-core/schema";
import { blueprintGraphSchema, observabilityLogSchema, traceSpanSchema } from "@abhinav2203/codeflow-core/schema";
import { observabilityPath } from "../shared/utils.js";
import { loadObservabilityConfig } from "./config.js";
import { RingBuffer } from "./ring-buffer.js";

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
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }
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
  spans?: ObservabilitySnapshot["spans"];
  logs?: ObservabilitySnapshot["logs"];
  graph?: BlueprintGraph;
}): Promise<ObservabilitySnapshot> => {
  if (typeof projectName !== "string" || projectName.trim().length === 0) {
    throw new Error(`projectName must be a non-empty string; received: ${JSON.stringify(projectName)}`);
  }

  const validatedSpans = traceSpanSchema.array().parse(spans ?? []);
  const validatedLogs = observabilityLogSchema.array().parse(logs ?? []);

  const { maxSpans, maxLogs } = await loadObservabilityConfig(projectName);
  const existing = await loadObservabilitySnapshot(projectName);

  const spansBuffer = new RingBuffer<ObservabilitySnapshot["spans"][number]>(maxSpans);
  const logsBuffer = new RingBuffer<ObservabilitySnapshot["logs"][number]>(maxLogs);

  if (existing?.spans) spansBuffer.push(...existing.spans);
  if (existing?.logs) logsBuffer.push(...existing.logs);
  spansBuffer.push(...validatedSpans);
  logsBuffer.push(...validatedLogs);

  const snapshot: ObservabilitySnapshot = {
    projectName,
    updatedAt: new Date().toISOString(),
    spans: spansBuffer.toArray() as ObservabilitySnapshot["spans"],
    logs: logsBuffer.toArray() as ObservabilitySnapshot["logs"],
    graph: graph ? blueprintGraphSchema.parse(graph) : existing?.graph
  };

  await writeSnapshotFile(projectName, snapshot);
  return snapshot;
};
