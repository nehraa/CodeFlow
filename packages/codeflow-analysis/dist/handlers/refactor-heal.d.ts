import { NextResponse } from "next/server";
/**
 * POST /api/refactor/heal
 *
 * Body: {@link BlueprintGraph}
 *
 * Detects all drift issues, then auto-heals the graph:
 * removes broken edges, synthesises missing edges from contract calls,
 * and syncs node signatures to match their first contract method.
 *
 * Returns both the detection report and the healed graph.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    report: import("..").RefactorReport;
    result: import("..").HealResult;
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=refactor-heal.d.ts.map