import { NextResponse } from "next/server";

import { evolveArchitectures } from "@/lib/blueprint/genetic";
import { evolveArchitectureRequestSchema } from "@/lib/blueprint/schema";

/**
 * POST /api/genetic/evolve
 *
 * Run an architectural genetic-algorithm tournament on the supplied blueprint
 * graph.  Returns a {@link TournamentResult} containing all evolved variants
 * ranked by fitness, plus the winning architecture with a summary.
 *
 * Request body: {@link EvolveArchitectureRequest}
 * - `graph`          — The source blueprint graph to evolve from.
 * - `generations`    — Number of evolutionary generations (default 3, max 10).
 * - `populationSize` — Number of competing variants (default 6, max 12).
 */
export async function POST(request: Request) {
  try {
    const body = evolveArchitectureRequestSchema.parse(await request.json());
    const result = evolveArchitectures(body.graph, {
      generations: body.generations,
      populationSize: body.populationSize
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to run architecture evolution tournament."
      },
      { status: 400 }
    );
  }
}
