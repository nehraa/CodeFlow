import { describe, expect, it } from "vitest";
import {
  computeSandboxDiff,
  generateDiffManifest,
  type SandboxDiffEntry
} from "./sandbox-diff.js";

// ── computeSandboxDiff ───────────────────────────────────────────────────────

describe("computeSandboxDiff", () => {
  it("returns 'added' for files in target but not in sandbox", () => {
    const entries = computeSandboxDiff([], ["new-file.ts"]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: "new-file.ts", status: "added" });
  });

  it("returns 'deleted' for files in sandbox but not in target", () => {
    const entries = computeSandboxDiff(["deleted-file.ts"], []);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: "deleted-file.ts", status: "deleted" });
  });

  it("returns 'unchanged' for files present in both sets", () => {
    const entries = computeSandboxDiff(["shared.ts"], ["shared.ts"]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ path: "shared.ts", status: "unchanged" });
  });

  it("marks files with different paths as added/deleted", () => {
    const entries = computeSandboxDiff(["a.ts"], ["b.ts"]);
    expect(entries).toContainEqual(expect.objectContaining({ path: "a.ts", status: "deleted" }));
    expect(entries).toContainEqual(expect.objectContaining({ path: "b.ts", status: "added" }));
  });

  it("handles empty inputs gracefully", () => {
    expect(computeSandboxDiff([], [])).toHaveLength(0);
  });

  it("does not duplicate entries for unchanged files", () => {
    const entries = computeSandboxDiff(["a.ts", "b.ts"], ["a.ts", "b.ts"]);
    expect(entries).toHaveLength(2);
  });

  it("sorts entries alphabetically by path", () => {
    const entries = computeSandboxDiff(["b.ts", "a.ts"], ["c.ts"]);
    expect(entries[0].path).toBe("a.ts");
    expect(entries[1].path).toBe("b.ts");
    expect(entries[2].path).toBe("c.ts");
  });
});

// ── generateDiffManifest ────────────────────────────────────────────────────

describe("generateDiffManifest", () => {
  it("returns a valid JSON string", () => {
    const entries: SandboxDiffEntry[] = [
      { path: "a.ts", status: "added" },
      { path: "b.ts", status: "deleted" }
    ];
    const manifest = generateDiffManifest(entries);
    expect(() => JSON.parse(manifest)).not.toThrow();
  });

  it("includes all entries in the JSON output", () => {
    const entries: SandboxDiffEntry[] = [
      { path: "a.ts", status: "added" },
      { path: "b.ts", status: "deleted" }
    ];
    const manifest = generateDiffManifest(entries);
    const parsed = JSON.parse(manifest);
    expect(parsed).toHaveLength(2);
  });

  it("includes path and status for each entry", () => {
    const entries: SandboxDiffEntry[] = [
      { path: "a.ts", status: "added" }
    ];
    const manifest = generateDiffManifest(entries);
    const parsed = JSON.parse(manifest);
    expect(parsed[0]).toMatchObject({ path: "a.ts", status: "added" });
  });

  it("returns '[]' for empty array", () => {
    expect(generateDiffManifest([])).toBe("[]");
  });
});
