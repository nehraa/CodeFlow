import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSessionId, saveSession, loadLatestSession, upsertSession } from "./index.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");
const cleanStore = () => {
    try {
        fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors — best effort
    }
};
const withEnv = async (fn) => {
    const original = process.env.CODEFLOW_STORE_ROOT;
    process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
    try {
        return await fn();
    }
    finally {
        process.env.CODEFLOW_STORE_ROOT = original ?? "";
        cleanStore();
    }
};
const makeGraph = (overrides = {}) => {
    const base = {
        projectName: "test-project",
        mode: "essential",
        phase: "spec",
        generatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
        workflows: [],
        warnings: []
    };
    return { ...base, ...overrides };
};
const makeRunPlan = () => ({
    generatedAt: new Date().toISOString(),
    tasks: [],
    batches: [],
    warnings: []
});
const makeSession = (overrides = {}) => ({
    sessionId: "session-1",
    projectName: "test-project",
    updatedAt: new Date().toISOString(),
    graph: makeGraph(),
    runPlan: makeRunPlan(),
    lastRiskReport: undefined,
    lastExportResult: undefined,
    lastExecutionReport: undefined,
    approvalIds: [],
    ...overrides
});
describe("session", () => {
    beforeEach(() => {
        cleanStore();
    });
    describe("createSessionId", () => {
        it("returns a valid UUID v4", () => {
            const id = createSessionId();
            expect(typeof id).toBe("string");
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
        it("returns unique IDs each call", () => {
            const id1 = createSessionId();
            const id2 = createSessionId();
            expect(id1).not.toBe(id2);
        });
    });
    describe("saveSession", () => {
        it("writes a latest.json and a history file", async () => {
            await withEnv(async () => {
                const session = makeSession();
                await saveSession(session);
                const latestPath = path.join(STORE_ROOT, "sessions", "test-project", "latest.json");
                const historyPath = path.join(STORE_ROOT, "sessions", "test-project", "history", "session-1.json");
                const latestContent = await fs.readFile(latestPath, "utf8");
                expect(JSON.parse(latestContent).sessionId).toBe("session-1");
                const historyContent = await fs.readFile(historyPath, "utf8");
                expect(JSON.parse(historyContent).sessionId).toBe("session-1");
            });
        });
        it("overwrites latest.json when saving again", async () => {
            await withEnv(async () => {
                const session1 = makeSession({ sessionId: "session-1", updatedAt: "2026-01-01T00:00:00.000Z" });
                await saveSession(session1);
                const session2 = makeSession({ sessionId: "session-2", updatedAt: "2026-01-02T00:00:00.000Z" });
                await saveSession(session2);
                const latestPath = path.join(STORE_ROOT, "sessions", "test-project", "latest.json");
                const latest = JSON.parse(await fs.readFile(latestPath, "utf8"));
                expect(latest.sessionId).toBe("session-2");
            });
        });
    });
    describe("loadLatestSession", () => {
        it("returns null when no session exists", async () => {
            await withEnv(async () => {
                const result = await loadLatestSession("nonexistent");
                expect(result).toBeNull();
            });
        });
        it("returns the session when it exists", async () => {
            await withEnv(async () => {
                const session = makeSession();
                await saveSession(session);
                const result = await loadLatestSession("test-project");
                expect(result).not.toBeNull();
                expect(result.sessionId).toBe("session-1");
                expect(result.projectName).toBe("test-project");
            });
        });
        it("returns null when latest.json is malformed", async () => {
            await withEnv(async () => {
                const latestPath = path.join(STORE_ROOT, "sessions", "test-project", "latest.json");
                await fs.mkdir(path.dirname(latestPath), { recursive: true });
                await fs.writeFile(latestPath, "{ not valid json");
                const result = await loadLatestSession("test-project");
                expect(result).toBeNull();
            });
        });
    });
    describe("upsertSession", () => {
        it("creates a new session when none exists", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                const session = await upsertSession({ graph, runPlan });
                expect(session.sessionId).toBeDefined();
                expect(session.projectName).toBe("test-project");
                expect(session.graph).toBeDefined();
                expect(session.runPlan).toBeDefined();
            });
        });
        it("preserves existing sessionId on update", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                const first = await upsertSession({ graph, runPlan, sessionId: "my-session" });
                const second = await upsertSession({ graph, runPlan, sessionId: first.sessionId });
                expect(second.sessionId).toBe(first.sessionId);
            });
        });
        it("accumulates approvalIds", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                const first = await upsertSession({ graph, runPlan, approvalId: "approval-1" });
                const second = await upsertSession({ graph, runPlan, approvalId: "approval-2" });
                expect(first.approvalIds).toContain("approval-1");
                expect(second.approvalIds).toContain("approval-1");
                expect(second.approvalIds).toContain("approval-2");
                expect(second.approvalIds).toHaveLength(2);
            });
        });
        it("does not duplicate approvalIds on multiple upserts", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                await upsertSession({ graph, runPlan, approvalId: "approval-1" });
                await upsertSession({ graph, runPlan, approvalId: "approval-1" });
                const latest = await loadLatestSession("test-project");
                expect(latest.approvalIds).toHaveLength(1);
                expect(latest.approvalIds[0]).toBe("approval-1");
            });
        });
        it("preserves lastRiskReport from existing session", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                const riskReport = {
                    score: 5,
                    level: "medium",
                    requiresApproval: true,
                    factors: []
                };
                await upsertSession({ graph, runPlan });
                await upsertSession({ graph, runPlan, lastRiskReport: riskReport });
                const latest = await loadLatestSession("test-project");
                expect(latest.lastRiskReport).toBeDefined();
                expect(latest.lastRiskReport.score).toBe(5);
            });
        });
        it("overrides lastRiskReport when explicitly passed", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                await upsertSession({
                    graph,
                    runPlan,
                    lastRiskReport: { score: 2, level: "low", requiresApproval: false, factors: [] }
                });
                await upsertSession({
                    graph,
                    runPlan,
                    lastRiskReport: { score: 8, level: "high", requiresApproval: true, factors: [] }
                });
                const latest = await loadLatestSession("test-project");
                expect(latest.lastRiskReport.score).toBe(8);
                expect(latest.lastRiskReport.level).toBe("high");
            });
        });
        it("sets updatedAt on every upsert", async () => {
            await withEnv(async () => {
                const graph = makeGraph();
                const runPlan = makeRunPlan();
                const first = await upsertSession({ graph, runPlan });
                await new Promise((r) => setTimeout(r, 10));
                const second = await upsertSession({ graph, runPlan });
                expect(second.updatedAt).not.toBe(first.updatedAt);
            });
        });
    });
});
//# sourceMappingURL=session.test.js.map