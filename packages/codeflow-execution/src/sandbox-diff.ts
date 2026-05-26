/**
 * sandbox-diff.ts
 *
 * Compute and track file changes in the workspace post-execution.
 */

import type { BlueprintGraph } from "@abhinav2203/codeflow-core";

// ── Types ────────────────────────────────────────────────────────────────────────

export type DiffStatus = "added" | "changed" | "deleted" | "unchanged";

export interface SandboxDiffEntry {
  path: string;
  status: DiffStatus;
  hash?: string;
}

// ── Core computation ─────────────────────────────────────────────────────────

/**
 * Computes the diff between sandbox files and target files.
 * Returns entries sorted alphabetically by path.
 */
export const computeSandboxDiff = (
  sandboxFiles: string[],
  targetFiles: string[]
): SandboxDiffEntry[] => {
  const sandboxSet = new Set(sandboxFiles);
  const targetSet = new Set(targetFiles);
  const allPaths = new Set([...sandboxSet, ...targetSet]);

  const entries: SandboxDiffEntry[] = [];

  for (const path of allPaths) {
    const inSandbox = sandboxSet.has(path);
    const inTarget = targetSet.has(path);

    let status: DiffStatus;
    if (inTarget && !inSandbox) {
      status = "added"; // in target but not in sandbox
    } else if (!inTarget && inSandbox) {
      status = "deleted"; // in sandbox but not in target
    } else if (inSandbox && inTarget) {
      status = "unchanged";
    } else {
      status = "unchanged";
    }

    entries.push({ path, status });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
};

// ── Manifest generation ──────────────────────────────────────────────────────

/**
 * Generates a JSON string manifest from diff entries.
 */
export const generateDiffManifest = (entries: SandboxDiffEntry[]): string => {
  return JSON.stringify(entries);
};
