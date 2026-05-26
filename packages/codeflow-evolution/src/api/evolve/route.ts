import { evolveArchitectures } from "../../genetic.js";

interface EvolveRequestBody {
  graph: Parameters<typeof evolveArchitectures>[0];
  generations?: number;
  populationSize?: number;
}

/**
 * POST /api/genetic/evolve
 *
 * Run an architectural genetic-algorithm tournament on the supplied blueprint
 * graph.  Returns a TournamentResult containing all evolved variants
 * ranked by fitness, plus the winning architecture with a summary.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as EvolveRequestBody;
    const result = evolveArchitectures(body.graph, {
      generations: body.generations ?? 3,
      populationSize: body.populationSize ?? 6,
    });

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to run architecture evolution tournament.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}