import { NextResponse } from "next/server";
/**
 * POST /api/analysis/metrics
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns structural graph metrics: node/edge counts, degree statistics,
 * density, connected components, and contract-level averages.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    metrics: {
        analyzedAt: string;
        nodeCount: number;
        edgeCount: number;
        nodesByKind: Record<string, number>;
        edgesByKind: Record<string, number>;
        nodesByStatus: Record<string, number>;
        density: number;
        avgDegree: number;
        maxInDegree: number;
        maxOutDegree: number;
        avgMethodsPerNode: number;
        avgResponsibilitiesPerNode: number;
        totalMethods: number;
        totalResponsibilities: number;
        connectedComponents: number;
        isolatedNodes: number;
        leafNodes: number;
        maxInDegreeNodeId?: string | undefined;
        maxOutDegreeNodeId?: string | undefined;
    };
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=metrics.d.ts.map