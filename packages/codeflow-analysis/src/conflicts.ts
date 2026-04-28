import path from "node:path";

import { analyzeTypeScriptRepo } from "@abhinav2203/codeflow-core/analyzer";
import type {
  BlueprintGraph,
  BlueprintNode,
  ConflictRecord,
  ConflictReport,
} from "@abhinav2203/codeflow-core/schema";

const repoKeyForNode = (node: BlueprintNode): string =>
  `${node.kind}:${node.path ?? ""}:${node.name}`;

/**
 * Detect structural conflicts between a blueprint graph and a live TypeScript repository.
 *
 * Conflicts detected:
 * - `missing-in-repo`     – blueprint node has no corresponding symbol in the repo snapshot.
 * - `missing-in-blueprint` – repo has a symbol not represented in the blueprint.
 * - `signature-mismatch`  – blueprint node `signature` differs from the repo-derived signature.
 * - `summary-mismatch`   – blueprint node `summary` differs from the repo-derived summary.
 */
export const detectGraphConflicts = async (
  graph: BlueprintGraph,
  repoPath: string
): Promise<ConflictReport> => {
  const repoGraph = await analyzeTypeScriptRepo(path.resolve(repoPath));
  const conflicts: ConflictRecord[] = [];

  // Only consider code-bearing nodes (not modules, which are structural containers).
  const repoNodes = repoGraph.nodes.filter((node) => node.kind !== "module");
  const blueprintRepoNodes = graph.nodes.filter((node) =>
    node.sourceRefs.some((ref) => ref.kind === "repo")
  );

  const repoMap = new Map(repoNodes.map((node) => [repoKeyForNode(node), node]));
  const blueprintMap = new Map(blueprintRepoNodes.map((node) => [repoKeyForNode(node), node]));

  // Check each blueprint node against the repo snapshot.
  for (const blueprintNode of blueprintRepoNodes) {
    const repoNode = repoMap.get(repoKeyForNode(blueprintNode));

    if (!repoNode) {
      conflicts.push({
        kind: "missing-in-repo",
        nodeId: blueprintNode.id,
        path: blueprintNode.path,
        blueprintValue: blueprintNode.name,
        message: `${blueprintNode.name} is in the blueprint but not in the repo snapshot.`,
        suggestedAction:
          "Remove the node from the blueprint or recreate it in the repo.",
      });
      continue;
    }

    if ((blueprintNode.signature ?? "") !== (repoNode.signature ?? "")) {
      conflicts.push({
        kind: "signature-mismatch",
        nodeId: blueprintNode.id,
        path: blueprintNode.path,
        blueprintValue: blueprintNode.signature,
        repoValue: repoNode.signature,
        message: `${blueprintNode.name} has a different signature in the repo.`,
        suggestedAction:
          "Refresh the blueprint contract from the repo or update the implementation.",
      });
    }

    if (
      blueprintNode.summary &&
      repoNode.summary &&
      blueprintNode.summary !== repoNode.summary
    ) {
      conflicts.push({
        kind: "summary-mismatch",
        nodeId: blueprintNode.id,
        path: blueprintNode.path,
        blueprintValue: blueprintNode.summary,
        repoValue: repoNode.summary,
        message: `${blueprintNode.name} summary diverges from the repo-derived description.`,
        suggestedAction:
          "Review the contract summary and align it with current behavior.",
      });
    }
  }

  // Detect repo symbols missing from the blueprint.
  for (const repoNode of repoNodes) {
    if (!blueprintMap.has(repoKeyForNode(repoNode))) {
      conflicts.push({
        kind: "missing-in-blueprint",
        path: repoNode.path,
        repoValue: repoNode.name,
        message: `${repoNode.name} exists in the repo but is not represented in the blueprint.`,
        suggestedAction:
          "Add the node to the blueprint or mark it intentionally out of scope.",
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    repoPath: path.resolve(repoPath),
    conflicts,
  };
};
