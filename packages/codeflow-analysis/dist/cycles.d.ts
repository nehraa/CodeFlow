import { z } from "zod";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
export declare const cycleSchema: z.ZodObject<{
    nodeIds: z.ZodArray<z.ZodString, "many">;
    edges: z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        kind: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: string;
        from: string;
        to: string;
    }, {
        kind: string;
        from: string;
        to: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    edges: {
        kind: string;
        from: string;
        to: string;
    }[];
    nodeIds: string[];
}, {
    edges: {
        kind: string;
        from: string;
        to: string;
    }[];
    nodeIds: string[];
}>;
export type Cycle = z.infer<typeof cycleSchema>;
export declare const cycleReportSchema: z.ZodObject<{
    analyzedAt: z.ZodString;
    totalCycles: z.ZodNumber;
    maxCycleLength: z.ZodNumber;
    cycles: z.ZodArray<z.ZodObject<{
        nodeIds: z.ZodArray<z.ZodString, "many">;
        edges: z.ZodArray<z.ZodObject<{
            from: z.ZodString;
            to: z.ZodString;
            kind: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: string;
            from: string;
            to: string;
        }, {
            kind: string;
            from: string;
            to: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        edges: {
            kind: string;
            from: string;
            to: string;
        }[];
        nodeIds: string[];
    }, {
        edges: {
            kind: string;
            from: string;
            to: string;
        }[];
        nodeIds: string[];
    }>, "many">;
    affectedNodeIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    analyzedAt: string;
    totalCycles: number;
    maxCycleLength: number;
    cycles: {
        edges: {
            kind: string;
            from: string;
            to: string;
        }[];
        nodeIds: string[];
    }[];
    affectedNodeIds: string[];
}, {
    analyzedAt: string;
    totalCycles: number;
    maxCycleLength: number;
    cycles: {
        edges: {
            kind: string;
            from: string;
            to: string;
        }[];
        nodeIds: string[];
    }[];
    affectedNodeIds: string[];
}>;
export type CycleReport = z.infer<typeof cycleReportSchema>;
/**
 * Detect all directed cycles in a blueprint graph using Tarjan's strongly-connected
 * components algorithm (iterative, stack-safe).
 *
 * Self-loop edges (from === to) are detected separately and treated as single-node cycles.
 */
export declare const detectCycles: (graph: BlueprintGraph) => CycleReport;
/**
 * Returns true if the graph contains at least one directed cycle.
 * Faster than detectCycles — stops early on the first cycle found.
 */
export declare const hasCycles: (graph: BlueprintGraph) => boolean;
//# sourceMappingURL=cycles.d.ts.map