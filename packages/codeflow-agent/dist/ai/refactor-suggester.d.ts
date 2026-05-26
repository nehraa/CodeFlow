/**
 * Code analysis and refactoring suggestion engine.
 *
 * Scans blueprint graph structure and issues suggestions for:
 * - Structural improvements (god nodes, missing abstractions)
 * - Contract completeness (missing inputs/outputs/errors)
 * - Dead code / orphaned nodes
 * - Circular dependencies
 * - Naming / identity consistency
 */
import type { BlueprintGraph } from '@abhinav2203/codeflow-core';
export interface RefactorIssue {
    type: 'deep-nesting' | 'long-function' | 'magic-number' | 'global-state';
    message: string;
    line?: number;
}
export interface CodeAnalysisResult {
    issues: RefactorIssue[];
    suggestions: string[];
}
export interface RefactorSuggestion {
    id: string;
    severity: "info" | "warning" | "error";
    nodeId?: string;
    title: string;
    description: string;
    recommendation: string;
    effort: "low" | "medium" | "high";
}
/**
 * Analyze a blueprint graph and return prioritized refactoring suggestions.
 * Each suggestion carries an effort estimate to help prioritize fixes.
 */
export declare const analyzeAndSuggestRefactors: (graph: BlueprintGraph) => RefactorSuggestion[];
/**
 * Analyze code string and return refactoring issues and suggestions.
 * Detects: deep nesting, long functions, magic numbers, global mutable state.
 */
export declare const suggestRefactors: (code: string, _nodeType: string) => CodeAnalysisResult;
//# sourceMappingURL=refactor-suggester.d.ts.map