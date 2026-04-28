import { NextResponse } from "next/server";
import { detectSmells } from "../smells";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";
/**
 * POST /api/analysis/smells
 *
 * Body: {@link BlueprintGraph}
 *
 * Returns an architecture smell report including god-node, hub-node,
 * orphan-node, tight-coupling, unstable-dependency, and scattered-responsibility
 * detections along with an overall health score.
 */
export async function POST(request) {
    try {
        const payload = blueprintGraphSchema.parse(await request.json());
        const report = detectSmells(payload);
        return NextResponse.json({ report });
    }
    catch (error) {
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Failed to detect architecture smells.",
        }, { status: 400 });
    }
}
