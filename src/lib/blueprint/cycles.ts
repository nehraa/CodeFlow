import { z } from "zod";

import type { BlueprintGraph } from "@/lib/blueprint/schema";

export const cycleSchema = z.object({
  nodeIds: z.array(z.string()),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      kind: z.string(),
    })
  ),
});
export type Cycle = z.infer<typeof cycleSchema>;

export const cycleReportSchema = z.object({
  analyzedAt: z.string(),
  totalCycles: z.number(),
  maxCycleLength: z.number(),
  cycles: z.array(cycleSchema),
  affectedNodeIds: z.array(z.string()),
});
export type CycleReport = z.infer<typeof cycleReportSchema>;

const tarjanIterative = (nodeIds: string[], adjacency: Map<string, string[]>): string[][] => {
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let index = 0;

  type Frame = {
    node: string;
    neighborIndex: number;
    neighbors: string[];
  };

  for (const root of nodeIds) {
    if (indices.has(root)) continue;

    const callStack: Frame[] = [{ node: root, neighborIndex: 0, neighbors: adjacency.get(root) ?? [] }];
    indices.set(root, index);
    lowlinks.set(root, index);
    index++;
    stack.push(root);
    onStack.add(root);

    while (callStack.length > 0) {
      const frame = callStack[callStack.length - 1];

      if (frame.neighborIndex < frame.neighbors.length) {
        const neighbor = frame.neighbors[frame.neighborIndex];
        frame.neighborIndex++;

        if (!indices.has(neighbor)) {
          indices.set(neighbor, index);
          lowlinks.set(neighbor, index);
          index++;
          stack.push(neighbor);
          onStack.add(neighbor);
          callStack.push({ node: neighbor, neighborIndex: 0, neighbors: adjacency.get(neighbor) ?? [] });
        } else if (onStack.has(neighbor)) {
          lowlinks.set(frame.node, Math.min(lowlinks.get(frame.node)!, lowlinks.get(neighbor)!));
        }
      } else {
        if (lowlinks.get(frame.node) === indices.get(frame.node)) {
          const scc: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            scc.push(w);
          } while (w !== frame.node);
          sccs.push(scc);
        }

        callStack.pop();
        if (callStack.length > 0) {
          const parent = callStack[callStack.length - 1];
          lowlinks.set(parent.node, Math.min(lowlinks.get(parent.node)!, lowlinks.get(frame.node)!));
        }
      }
    }
  }

  return sccs;
};

export const detectCycles = (graph: BlueprintGraph): CycleReport => {
  const nodeIds = graph.nodes.map((n) => n.id);
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const sccs = tarjanIterative(nodeIds, adjacency);

  // A self-loop (from === to) is a genuine cycle but Tarjan's SCC returns it as
  // a size-1 SCC.  Detect them separately and treat them as single-node cycles.
  const selfLoopNodeIds = new Set(
    graph.edges.filter((e) => e.from === e.to).map((e) => e.from)
  );
  const selfLoopSccs: string[][] = [...selfLoopNodeIds].map((id) => [id]);

  const sccSet = [
    ...sccs.filter((scc) => scc.length >= 2),
    ...selfLoopSccs
  ];

  const cycles: Cycle[] = sccSet.map((scc) => {
    const memberSet = new Set(scc);
    const edges = graph.edges
      .filter((e) => memberSet.has(e.from) && memberSet.has(e.to))
      .map((e) => ({ from: e.from, to: e.to, kind: e.kind }));
    return { nodeIds: scc, edges };
  });

  const affectedNodeIds = [...new Set(cycles.flatMap((c) => c.nodeIds))];
  const maxCycleLength = cycles.reduce((max, c) => Math.max(max, c.nodeIds.length), 0);

  return {
    analyzedAt: new Date().toISOString(),
    totalCycles: cycles.length,
    maxCycleLength,
    cycles,
    affectedNodeIds,
  };
};

export const hasCycles = (graph: BlueprintGraph): boolean => {
  if (graph.edges.some((e) => e.from === e.to)) return true;

  const nodeIds = graph.nodes.map((n) => n.id);
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const sccs = tarjanIterative(nodeIds, adjacency);
  return sccs.some((scc) => scc.length >= 2);
};
