import type { BlueprintGraph, ConflictReport } from "../schema/index.js";
export declare const detectGraphConflicts: (graph: BlueprintGraph, repoPath: string) => Promise<ConflictReport>;
