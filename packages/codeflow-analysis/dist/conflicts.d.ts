import type { BlueprintGraph, ConflictReport } from "@abhinav2203/codeflow-core/schema";
/**
 * Detect structural conflicts between a blueprint graph and a live TypeScript repository.
 *
 * Conflicts detected:
 * - `missing-in-repo`     – blueprint node has no corresponding symbol in the repo snapshot.
 * - `missing-in-blueprint` – repo has a symbol not represented in the blueprint.
 * - `signature-mismatch`  – blueprint node `signature` differs from the repo-derived signature.
 * - `summary-mismatch`   – blueprint node `summary` differs from the repo-derived summary.
 */
export declare const detectGraphConflicts: (graph: BlueprintGraph, repoPath: string) => Promise<ConflictReport>;
//# sourceMappingURL=conflicts.d.ts.map