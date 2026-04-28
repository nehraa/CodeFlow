import { describe, it, expect, vi, beforeEach } from "vitest";
import { snapshotBranchReasoning, loadBranchReasoningHistory, summarizeReasoningForBranch } from "./index";
// Mock the store modules
vi.mock("@abhinav2203/codeflow-store/checkpoint", () => ({
    recoverRun: vi.fn()
}));
vi.mock("@abhinav2203/codeflow-store/reasoning", () => ({
    loadReasoningForRun: vi.fn(),
    loadReasoningForProject: vi.fn()
}));
import { recoverRun } from "@abhinav2203/codeflow-store/checkpoint";
import { loadReasoningForProject } from "@abhinav2203/codeflow-store/reasoning";
const makeCheckpoint = (overrides = {}) => ({
    runId: "run-1",
    projectName: "test-project",
    taskId: "task-1",
    content: "Analyzing requirement...",
    savedAt: "2026-04-23T10:00:00.000Z",
    ...overrides
});
describe("snapshotBranchReasoning", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns a snapshot with the given runId and projectName", async () => {
        vi.mocked(recoverRun).mockResolvedValue([]);
        const snapshot = await snapshotBranchReasoning("run-1", "my-project");
        expect(snapshot.runId).toBe("run-1");
        expect(snapshot.projectName).toBe("my-project");
    });
    it("calls recoverRun with the correct arguments", async () => {
        vi.mocked(recoverRun).mockResolvedValue([]);
        await snapshotBranchReasoning("run-abc", "My App");
        expect(recoverRun).toHaveBeenCalledWith("run-abc", "My App");
    });
    it("includes checkpoints returned by recoverRun", async () => {
        const checkpoints = [
            makeCheckpoint({ taskId: "task-1", content: "Step 1" }),
            makeCheckpoint({ taskId: "task-2", content: "Step 2" })
        ];
        vi.mocked(recoverRun).mockResolvedValue(checkpoints);
        const snapshot = await snapshotBranchReasoning("run-1", "my-project");
        expect(snapshot.checkpoints).toHaveLength(2);
        expect(snapshot.checkpoints[0].taskId).toBe("task-1");
    });
    it("sets savedAt to a valid ISO string", async () => {
        vi.mocked(recoverRun).mockResolvedValue([]);
        const snapshot = await snapshotBranchReasoning("run-1", "my-project");
        expect(snapshot.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    it("returns empty checkpoints when recoverRun returns empty array", async () => {
        vi.mocked(recoverRun).mockResolvedValue([]);
        const snapshot = await snapshotBranchReasoning("run-1", "my-project");
        expect(snapshot.checkpoints).toHaveLength(0);
    });
});
describe("loadBranchReasoningHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("calls loadReasoningForProject with the project name", async () => {
        vi.mocked(loadReasoningForProject).mockResolvedValue([]);
        await loadBranchReasoningHistory("my-project");
        expect(loadReasoningForProject).toHaveBeenCalledWith("my-project");
    });
    it("maps each summary to a BranchReasoningSnapshot", async () => {
        vi.mocked(loadReasoningForProject).mockResolvedValue([
            {
                runId: "run-1",
                projectName: "my-project",
                checkpoints: [
                    makeCheckpoint({ taskId: "task-a", content: "Reasoning A" })
                ]
            },
            {
                runId: "run-2",
                projectName: "my-project",
                checkpoints: [
                    makeCheckpoint({ taskId: "task-b", content: "Reasoning B" })
                ]
            }
        ]);
        const history = await loadBranchReasoningHistory("my-project");
        expect(history).toHaveLength(2);
        expect(history[0].runId).toBe("run-1");
        expect(history[0].checkpoints).toHaveLength(1);
        expect(history[1].runId).toBe("run-2");
        expect(history[1].checkpoints[0].taskId).toBe("task-b");
    });
    it("sets savedAt to a valid ISO string for each snapshot", async () => {
        vi.mocked(loadReasoningForProject).mockResolvedValue([
            {
                runId: "run-1",
                projectName: "my-project",
                checkpoints: []
            }
        ]);
        const history = await loadBranchReasoningHistory("my-project");
        expect(history[0].savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    it("returns empty array when loadReasoningForProject returns empty", async () => {
        vi.mocked(loadReasoningForProject).mockResolvedValue([]);
        const history = await loadBranchReasoningHistory("my-project");
        expect(history).toHaveLength(0);
    });
});
describe("summarizeReasoningForBranch", () => {
    it("includes runId, projectName, savedAt, and checkpoint count", () => {
        const snapshot = {
            runId: "run-xyz",
            projectName: "My App",
            checkpoints: [
                makeCheckpoint({ taskId: "task-1", content: "Content here" })
            ],
            savedAt: "2026-04-23T10:00:00.000Z"
        };
        const output = summarizeReasoningForBranch(snapshot);
        expect(output).toContain("run-xyz");
        expect(output).toContain("My App");
        expect(output).toContain("1"); // checkpoint count
    });
    it("prints each checkpoint with taskId, savedAt, and content", () => {
        const snapshot = {
            runId: "run-1",
            projectName: "test-project",
            checkpoints: [
                makeCheckpoint({ taskId: "task-alpha", savedAt: "2026-04-23T12:00:00.000Z", content: "Analyzing..." })
            ],
            savedAt: "2026-04-23T10:00:00.000Z"
        };
        const output = summarizeReasoningForBranch(snapshot);
        expect(output).toContain("task-alpha");
        expect(output).toContain("2026-04-23T12:00:00.000Z");
        expect(output).toContain("Analyzing...");
    });
    it("shows '(no checkpoints)' when checkpoint list is empty", () => {
        const snapshot = {
            runId: "run-1",
            projectName: "test-project",
            checkpoints: [],
            savedAt: "2026-04-23T10:00:00.000Z"
        };
        const output = summarizeReasoningForBranch(snapshot);
        expect(output).toContain("(no checkpoints)");
    });
    it("renders multiple checkpoints sequentially", () => {
        const snapshot = {
            runId: "run-1",
            projectName: "test-project",
            checkpoints: [
                makeCheckpoint({ taskId: "task-1", content: "First step" }),
                makeCheckpoint({ taskId: "task-2", content: "Second step" }),
                makeCheckpoint({ taskId: "task-3", content: "Third step" })
            ],
            savedAt: "2026-04-23T10:00:00.000Z"
        };
        const output = summarizeReasoningForBranch(snapshot);
        expect(output).toContain("task-1");
        expect(output).toContain("First step");
        expect(output).toContain("task-2");
        expect(output).toContain("Second step");
        expect(output).toContain("task-3");
        expect(output).toContain("Third step");
    });
});
