import type { ArchitectureStyle, ArchitectureVariant, BlueprintGraph, TournamentResult, VariantBenchmark } from "./schema.js";
/**
 * Benchmark weights used to compute the aggregate fitness score.
 * All weights must sum to 1.0 so that fitness remains in the [0, 100] range
 * — it is a weighted average of four 0–100 subscores.
 */
export declare const BENCHMARK_WEIGHTS: {
    readonly scalability: 0.3;
    readonly estimatedCostScore: 0.2;
    readonly performance: 0.25;
    readonly maintainability: 0.25;
};
export declare const TOURNAMENT_PROVENANCE: "heuristic";
export declare const TOURNAMENT_MATURITY: "experimental";
/**
 * Compute benchmark scores for an architecture variant graph.
 *
 * Scores are derived from structural graph metrics so the benchmarks are
 * deterministic and require no external AI calls.
 */
export declare const benchmarkVariant: (graph: BlueprintGraph, style: ArchitectureStyle) => VariantBenchmark;
/**
 * Generate the initial population of architecture variants from a base graph.
 *
 * Returns one variant per architectural style.  Additional variants are
 * produced by mutating the base styles to reach the requested population size.
 */
export declare const generateInitialPopulation: (base: BlueprintGraph, populationSize: number) => ArchitectureVariant[];
/**
 * Run a full evolutionary tournament.
 *
 * Starting from the base graph, the algorithm:
 * 1. Creates the initial population of architecture variants.
 * 2. For each generation: selects the top survivors, produces offspring via
 *    crossover and mutation, then re-ranks the combined pool.
 * 3. Returns the full {@link TournamentResult} including all final variants and
 *    the winning architecture.
 */
export declare const evolveArchitectures: (base: BlueprintGraph, options: {
    generations: number;
    populationSize: number;
}) => TournamentResult;
//# sourceMappingURL=genetic.d.ts.map