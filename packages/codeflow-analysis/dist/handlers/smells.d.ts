import { NextResponse } from "next/server";
/**
 * POST /api/analysis/smells
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns an architecture smell report including god-node, hub-node,
 * orphan-node, tight-coupling, unstable-dependency, and scattered-responsibility
 * detections along with an overall health score.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    report: {
        analyzedAt: string;
        totalSmells: number;
        smells: {
            code: string;
            severity: "warning" | "info" | "critical";
            message: string;
            suggestion: string;
            nodeId?: string | undefined;
        }[];
        healthScore: number;
    };
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=smells.d.ts.map