import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadObservabilitySnapshot, mergeObservabilitySnapshot } from "./index.js";
import type { ObservabilitySnapshot, BlueprintGraph } from "@abhinav2203/codeflow-core/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");

const cleanStore = () => {
  try {
    fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — best effort
  }
};

const withEnv = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = process.env.CODEFLOW_STORE_ROOT;
  process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
  try {
    return await fn();
  } finally {
    process.env.CODEFLOW_STORE_ROOT = original ?? "";
    cleanStore();
  }
};

const makeSpan = (id: string, name: string) => ({
  spanId: id,
  traceId: "trace-1",
  name,
  blueprintNodeId: `node-${id}`,
  path: undefined,
  status: "success" as const,
  durationMs: 100,
  runtime: "test",
  provenance: "observed" as const,
  timestamp: new Date().toISOString()
});

const makeLog = (id: string, message: string) => ({
  id: `log-${id}`,
  level: "info" as const,
  message,
  blueprintNodeId: undefined,
  path: undefined,
  runtime: "test",
  timestamp: new Date().toISOString()
});

const makeGraph = (): BlueprintGraph => ({
  projectName: "test-project",
  mode: "essential",
  generatedAt: new Date().toISOString(),
  nodes: [],
  edges: [],
  workflows: [],
  warnings: []
});

describe("observability", () => {
  beforeEach(() => {
    cleanStore();
  });

  describe("loadObservabilitySnapshot", () => {
    it("returns null when no snapshot exists for the project", async () => {
      await withEnv(async () => {
        const result = await loadObservabilitySnapshot("nonexistent-project");
        expect(result).toBeNull();
      });
    });

    it("returns the existing snapshot when it exists", async () => {
      await withEnv(async () => {
        const snapshot: ObservabilitySnapshot = {
          projectName: "test-project",
          updatedAt: new Date().toISOString(),
          spans: [makeSpan("s1", "auth.validate")],
          logs: [makeLog("l1", "server started")]
        };

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: snapshot.spans,
          logs: snapshot.logs
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result).not.toBeNull();
        expect(result!.spans).toHaveLength(1);
        expect(result!.logs).toHaveLength(1);
        expect(result!.spans[0].name).toBe("auth.validate");
      });
    });
  });

  describe("mergeObservabilitySnapshot", () => {
    it("writes a snapshot to disk", async () => {
      await withEnv(async () => {
        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [makeSpan("s1", "auth.login")],
          logs: [makeLog("l1", "user logged in")]
        });

        const filePath = path.join(
          STORE_ROOT,
          "observability",
          "test-project.json"
        );
        const content = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        expect(parsed.projectName).toBe("test-project");
        expect(parsed.spans).toHaveLength(1);
      });
    });

    it("appends spans when merging (does not replace)", async () => {
      await withEnv(async () => {
        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [makeSpan("s1", "auth.login")],
          logs: []
        });

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [makeSpan("s2", "db.query")],
          logs: []
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.spans).toHaveLength(2);
        expect(result!.spans[0].spanId).toBe("s1");
        expect(result!.spans[1].spanId).toBe("s2");
      });
    });

    it("appends logs when merging (does not replace)", async () => {
      await withEnv(async () => {
        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: [makeLog("l1", "server started")]
        });

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: [makeLog("l2", "request received")]
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.logs).toHaveLength(2);
        expect(result!.logs[0].message).toBe("server started");
        expect(result!.logs[1].message).toBe("request received");
      });
    });

    it("caps spans at 500 items (slice -500)", async () => {
      await withEnv(async () => {
        // Create 600 spans
        const manySpans = Array.from({ length: 600 }, (_, i) =>
          makeSpan(`s${i}`, `span-${i}`)
        );

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: manySpans,
          logs: []
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.spans).toHaveLength(500);
        // Last 500 — so s100 through s599 should be present, s0-s99 dropped
        expect(result!.spans[0].spanId).toBe("s100");
        expect(result!.spans[499].spanId).toBe("s599");
      });
    });

    it("caps logs at 500 items", async () => {
      await withEnv(async () => {
        const manyLogs = Array.from({ length: 600 }, (_, i) =>
          makeLog(`l${i}`, `log message ${i}`)
        );

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: manyLogs
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.logs).toHaveLength(500);
      });
    });

    it("updates the graph when provided", async () => {
      await withEnv(async () => {
        const graph = makeGraph();

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: [],
          graph
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.graph).toBeDefined();
        expect(result!.graph!.projectName).toBe("test-project");
      });
    });

    it("preserves the existing graph when not provided", async () => {
      await withEnv(async () => {
        const graph = makeGraph();
        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: [],
          graph
        });

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [makeSpan("s1", "auth.login")],
          logs: []
          // no graph provided
        });

        const result = await loadObservabilitySnapshot("test-project");
        expect(result!.graph).toBeDefined();
      });
    });

    it("updates the updatedAt timestamp on merge", async () => {
      await withEnv(async () => {
        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [],
          logs: []
        });

        const first = await loadObservabilitySnapshot("test-project");
        const firstUpdatedAt = first!.updatedAt;

        // Wait a tiny bit to ensure timestamp differs
        await new Promise((r) => setTimeout(r, 10));

        await mergeObservabilitySnapshot({
          projectName: "test-project",
          spans: [makeSpan("s1", "auth.login")],
          logs: []
        });

        const second = await loadObservabilitySnapshot("test-project");
        expect(second!.updatedAt).not.toBe(firstUpdatedAt);
      });
    });
  });
});
