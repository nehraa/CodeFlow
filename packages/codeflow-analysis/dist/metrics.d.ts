import { z } from "zod";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
export declare const graphMetricsSchema: z.ZodObject<{
    analyzedAt: z.ZodString;
    nodeCount: z.ZodNumber;
    edgeCount: z.ZodNumber;
    nodesByKind: z.ZodRecord<z.ZodString, z.ZodNumber>;
    edgesByKind: z.ZodRecord<z.ZodString, z.ZodNumber>;
    nodesByStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
    density: z.ZodNumber;
    avgDegree: z.ZodNumber;
    maxInDegree: z.ZodNumber;
    maxOutDegree: z.ZodNumber;
    maxInDegreeNodeId: z.ZodOptional<z.ZodString>;
    maxOutDegreeNodeId: z.ZodOptional<z.ZodString>;
    avgMethodsPerNode: z.ZodNumber;
    avgResponsibilitiesPerNode: z.ZodNumber;
    totalMethods: z.ZodNumber;
    totalResponsibilities: z.ZodNumber;
    connectedComponents: z.ZodNumber;
    isolatedNodes: z.ZodNumber;
    leafNodes: z.ZodNumber;
}, z.core.$strip>;
export type GraphMetrics = z.infer<typeof graphMetricsSchema>;
/**
 * Compute structural metrics for a blueprint graph.
 *
 * Metrics include: node/edge counts, degree statistics, graph density,
 * connected components, isolated/leaf node counts, and contract-level
 * averages (methods and responsibilities per node).
 */
export declare const computeGraphMetrics: (graph: BlueprintGraph) => GraphMetrics;
//# sourceMappingURL=metrics.d.ts.map