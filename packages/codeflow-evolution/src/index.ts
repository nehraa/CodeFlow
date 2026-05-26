// Re-export all public types and functions
export {
  generateInitialPopulation,
  evolveArchitectures,
  benchmarkVariant,
  BENCHMARK_WEIGHTS,
  TOURNAMENT_PROVENANCE,
  TOURNAMENT_MATURITY,
} from "./genetic.js";

export type {
  ArchitectureStyle,
  ArchitectureVariant,
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  MaterializedBlueprintGraph,
  MaterializedBlueprintNode,
  TournamentResult,
  VariantBenchmark,
  GhostNode,
  MaterializedGhostNode,
} from "./schema.js";

export {
  architectureStyleSchema,
  variantBenchmarkSchema,
  tournamentResultSchema,
  blueprintGraphSchema,
  blueprintNodeSchema,
  blueprintEdgeSchema,
  ghostNodeSchema,
  graphMetricsSchema,
  emptyContract,
} from "./schema.js";

export { getGhostProvider, suggestGhostNodes } from "./ghost/index.js";
export type { GhostProvider } from "./providers/index.js";