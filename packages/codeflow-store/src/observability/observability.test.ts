import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { mergeObservabilitySnapshot } from "./index.js";

describe("mergeObservabilitySnapshot", () => {
  const tmpDir = path.join(os.tmpdir(), `codeflow-test-observability-${Date.now()}`);

  const makeSpan = (id: string) => ({
    spanId: id,
    traceId: "trace-1",
    name: id,
    status: "success" as const,
    durationMs: 10,
    runtime: "test",
    provenance: "observed" as const,
    timestamp: new Date().toISOString()
  });

  const makeLog = (msg: string) => ({
    id: `log-${msg}`,
    level: "info" as const,
    message: msg,
    runtime: "test",
    timestamp: new Date().toISOString()
  });

  beforeEach(async () => {
    process.env.CODEFLOW_STORE_ROOT = tmpDir;
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CODEFLOW_STORE_ROOT;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should use default cap of 500 when no config exists", async () => {
    const projectName = "test-project";
    const spans = Array.from({ length: 600 }, (_, i) => makeSpan(`span-${i}`));

    const result = await mergeObservabilitySnapshot({
      projectName,
      spans,
      logs: []
    });

    expect(result.spans).toHaveLength(500);
    expect(result.spans[0].spanId).toBe("span-100");
    expect(result.spans[499].spanId).toBe("span-599");
  });

  it("should respect custom maxSpans from config", async () => {
    const projectName = "custom-cap-project";
    await fs.mkdir(path.join(tmpDir, "observability-config"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "observability-config", `${projectName}.json`),
      JSON.stringify({ maxSpans: 3, maxLogs: 100 }),
      "utf8"
    );

    const result = await mergeObservabilitySnapshot({
      projectName,
      spans: [makeSpan("s1"), makeSpan("s2"), makeSpan("s3"), makeSpan("s4"), makeSpan("s5")],
      logs: []
    });

    expect(result.spans).toHaveLength(3);
    expect(result.spans.map(s => s.spanId)).toEqual(["s3", "s4", "s5"]);
  });

  it("should respect custom maxLogs from config", async () => {
    const projectName = "custom-logs-project";
    await fs.mkdir(path.join(tmpDir, "observability-config"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "observability-config", `${projectName}.json`),
      JSON.stringify({ maxSpans: 500, maxLogs: 2 }),
      "utf8"
    );

    const result = await mergeObservabilitySnapshot({
      projectName,
      spans: [],
      logs: [makeLog("log-1"), makeLog("log-2"), makeLog("log-3")]
    });

    expect(result.logs).toHaveLength(2);
    expect(result.logs.map(l => l.message)).toEqual(["log-2", "log-3"]);
  });

  it("should default logs to empty array when omitted", async () => {
    const result = await mergeObservabilitySnapshot({
      projectName: "no-logs-project",
      spans: [makeSpan("s1"), makeSpan("s2")]
    });
    expect(result.logs).toHaveLength(0);
    expect(result.spans).toHaveLength(2);
  });

  it("should throw clear error when projectName is not a non-empty string", async () => {
    await expect(
      mergeObservabilitySnapshot({ projectName: 123 as any, spans: [], logs: [] })
    ).rejects.toThrow(/projectName must be a non-empty string/);

    await expect(
      mergeObservabilitySnapshot({ projectName: "", spans: [], logs: [] })
    ).rejects.toThrow(/projectName must be a non-empty string/);

    await expect(
      mergeObservabilitySnapshot({ projectName: "   " as any, spans: [], logs: [] })
    ).rejects.toThrow(/projectName must be a non-empty string/);
  });

  it("should throw validation error for bad span data", async () => {
    await expect(
      // @ts-expect-error — deliberately passing invalid data
      mergeObservabilitySnapshot({ projectName: "bad-spans", spans: [{ spanId: 123 }], logs: [] })
    ).rejects.toThrow();
  });

  it("should throw clear error when called with null", async () => {
    await expect(
      mergeObservabilitySnapshot(null as any)
    ).rejects.toThrow(/options is required.*received null/i);
  });

  it("should throw clear error when called with undefined", async () => {
    await expect(
      mergeObservabilitySnapshot(undefined as any)
    ).rejects.toThrow(/options is required/i);
  });

  it("should throw clear error when projectName is null", async () => {
    await expect(
      mergeObservabilitySnapshot({ projectName: null as any, spans: [], logs: [] })
    ).rejects.toThrow(/projectName must be a non-empty string.*null/i);
  });

  it("should preserve existing spans and logs when merging", async () => {
    const projectName = "merge-test";
    const span1 = makeSpan("span-existing");
    const log1 = makeLog("log-existing");

    // First call creates initial snapshot
    await mergeObservabilitySnapshot({ projectName, spans: [span1], logs: [log1] });

    // Second call merges new data with existing
    const span2 = makeSpan("span-new");
    const result = await mergeObservabilitySnapshot({ projectName, spans: [span2], logs: [] });

    expect(result.spans).toHaveLength(2);
    expect(result.spans.map(s => s.spanId)).toContain("span-existing");
    expect(result.spans.map(s => s.spanId)).toContain("span-new");
  });

  it("should handle graph update correctly", async () => {
    const result = await mergeObservabilitySnapshot({
      projectName: "graph-update-test",
      spans: [],
      logs: [],
      graph: {
        projectName: "graph-update-test",
        mode: "essential" as const,
        generatedAt: new Date().toISOString(),
        nodes: [{ id: "n1", kind: "module" as const, name: "test", summary: "", path: "test.ts", contract: { summary: "", responsibilities: [], inputs: [], outputs: [], attributes: [], methods: [], sideEffects: [], errors: [], dependencies: [], calls: [], uiAccess: [], backendAccess: [], notes: [] }, sourceRefs: [], generatedRefs: [], traceRefs: [], status: "spec_only" as const }],
        edges: [],
        workflows: [],
        warnings: []
      }
    });

    expect(result.graph).toBeDefined();
    expect(result.graph!.nodes).toHaveLength(1);
  });

  it("should preserve graph when provided", async () => {
    const result = await mergeObservabilitySnapshot({
      projectName: "graph-test",
      spans: [],
      logs: [],
      graph: {
        projectName: "graph-test",
        mode: "essential" as const,
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        workflows: [],
        warnings: []
      }
    });

    expect(result.graph).toBeDefined();
  });
});