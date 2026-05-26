import { NextResponse } from "next/server";
/**
 * POST /api/analysis/cycles
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns a cycle detection report for the submitted blueprint graph.
 * Includes total cycle count, affected node IDs, per-cycle edge details,
 * and a convenience `hasCycles` boolean.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    report: {
        hasCycles: boolean;
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
    };
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=cycles.d.ts.map