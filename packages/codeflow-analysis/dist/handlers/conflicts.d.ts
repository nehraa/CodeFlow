import { NextResponse } from "next/server";
/**
 * POST /api/conflicts
 *
 * Body: { graph: BlueprintGraph, repoPath: string }
 *
 * Compares a blueprint graph against a live TypeScript repository,
 * detecting signature mismatches, summary mismatches, missing-in-repo
 * nodes, and missing-in-blueprint symbols.
 */
export declare function POST(request: Request): Promise<NextResponse<{
    report: {
        checkedAt: string;
        repoPath: string;
        conflicts: {
            kind: "missing-in-repo" | "missing-in-blueprint" | "signature-mismatch" | "summary-mismatch";
            message: string;
            suggestedAction: string;
            nodeId?: string | undefined;
            path?: string | undefined;
            blueprintValue?: string | undefined;
            repoValue?: string | undefined;
        }[];
    };
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=conflicts.d.ts.map