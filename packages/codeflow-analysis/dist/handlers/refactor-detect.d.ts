import { NextResponse } from "next/server";
/**
 * POST /api/refactor/detect
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns a {@link RefactorReport} describing all detected drift issues:
 * broken edges, missing edges, and signature drift.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    report: import("..").RefactorReport;
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=refactor-detect.d.ts.map