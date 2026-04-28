// cycles
export { detectCycles, hasCycles } from "./cycles.js";
export type { Cycle, CycleReport } from "./cycles.js";

// smells
export { detectSmells } from "./smells.js";
export type { Smell, SmellReport } from "./smells.js";

// metrics
export { computeGraphMetrics } from "./metrics.js";
export type { GraphMetrics } from "./metrics.js";

// refactor
export { detectDrift, healGraph } from "./refactor.js";
export type { DriftIssue, DriftKind, HealResult, RefactorReport } from "./refactor.js";

// conflicts
export { detectGraphConflicts } from "./conflicts.js";
