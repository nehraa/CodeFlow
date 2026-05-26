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

import type { BlueprintGraph, BlueprintNode } from '@abhinav2203/codeflow-core';
import { isCodeBearingNode } from './scaffold-utils.js';

// ---------------------------------------------------------------------------
// Suggestion types
// ---------------------------------------------------------------------------

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

const severityOf = (score: number): "error" | "warning" | "info" =>
  score >= 0.7 ? "error" : score >= 0.4 ? "warning" : "info";

const id = (prefix: string, idx: number) => `${prefix}-${idx}`;

// ---------------------------------------------------------------------------
// Individual analyzers
// ---------------------------------------------------------------------------

/**
 * Flags nodes whose contract has no inputs or outputs defined.
 * A node with an empty contract is often a design smell.
 */
const analyzeContractCompleteness = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  const suggestions: RefactorSuggestion[] = [];

  graph.nodes.filter(isCodeBearingNode).forEach((node, i) => {
    const inputs = node.contract?.inputs ?? [];
    const outputs = node.contract?.outputs ?? [];

    if (inputs.length === 0 && outputs.length === 0 && node.kind !== "module") {
      suggestions.push({
        id: id("empty-contract", i),
        severity: "warning",
        nodeId: node.id,
        title: "Empty contract on node",
        description: `Node "${node.name}" (${node.kind}) has no inputs or outputs defined. This suggests the contract was not fully specified.`,
        recommendation:
          "Add at least one input or output field to the node's contract, or consolidate this node into its caller.",
        effort: "medium"
      });
    }

    if (inputs.length > 10) {
      suggestions.push({
        id: id("too-many-inputs", i),
        severity: "info",
        nodeId: node.id,
        title: "High input arity",
        description: `Node "${node.name}" has ${inputs.length} inputs. High arity often indicates the node is doing too much.`,
        recommendation:
          "Consider extracting a parameter object or splitting this node into smaller nodes.",
        effort: "medium"
      });
    }
  });

  return suggestions;
};

/**
 * Finds nodes that have edges but no incoming edges (orphans at graph root).
 * These may be entry points — or forgotten connections.
 */
const analyzeOrphanNodes = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  const suggestions: RefactorSuggestion[] = [];
  const targets = new Set(graph.edges.map((e) => e.to));

  graph.nodes.filter(isCodeBearingNode).forEach((node, i) => {
    if (!targets.has(node.id) && node.kind !== "module") {
      suggestions.push({
        id: id("orphan", i),
        severity: "info",
        nodeId: node.id,
        title: "No incoming edges",
        description: `Node "${node.name}" has no consumers in the graph — it may be an orphaned node.`,
        recommendation:
          "Verify this node should have incoming edges from other nodes, or confirm it's an entry point.",
        effort: "low"
      });
    }
  });

  return suggestions;
};

/**
 * Detects potential circular dependencies in the graph.
 * Uses a simple DFS-based cycle detector restricted to code-bearing nodes.
 */
const analyzeCycles = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  const suggestions: RefactorSuggestion[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();

  graph.nodes.forEach((n) => adj.set(n.id, []));
  graph.edges.forEach((e) => {
    adj.get(e.from)!.push(e.to);
  });

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycleNodes: string[] = [];

  const dfs = (nodeId: string): void => {
    if (stack.has(nodeId)) {
      cycleNodes.push(nodeId);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);
    for (const neighbor of adj.get(nodeId) ?? []) {
      dfs(neighbor);
    }
    stack.delete(nodeId);
  };

  graph.nodes.forEach((n) => {
    cycleNodes.length = 0;
    dfs(n.id);
    if (cycleNodes.length > 0) {
      const cycleLabel = [...new Set(cycleNodes)]
        .map((id) => nodeMap.get(id)?.name ?? id)
        .join(" → ");
      suggestions.push({
        id: id("cycle", suggestions.length),
        severity: "error",
        title: "Circular dependency detected",
        description: `A cycle was detected involving: ${cycleLabel}`,
        recommendation:
          "Break the circular dependency by introducing an interface or consolidating nodes.",
        effort: "high"
      });
    }
  });

  return suggestions;
};

/**
 * Flags nodes that are "too large" — e.g., classes with many responsibilities
 * or functions with many calls / error cases.
 */
const analyzeNodeComplexity = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  const suggestions: RefactorSuggestion[] = [];

  graph.nodes.filter(isCodeBearingNode).forEach((node, i) => {
    if (node.kind === "class") {
      const responsibilities = node.contract?.responsibilities ?? [];
      if (responsibilities.length > 8) {
        suggestions.push({
          id: id("god-class", i),
          severity: "warning",
          nodeId: node.id,
          title: "Class has too many responsibilities",
          description: `"${node.name}" has ${responsibilities.length} responsibilities. This is a design smell.`,
          recommendation:
            "Split this class into smaller focused classes, each with a single responsibility.",
          effort: "high"
        });
      }
    }

    if (node.kind === "function") {
      const calls = node.contract?.calls ?? [];
      if (calls.length > 6) {
        suggestions.push({
          id: id("god-function", i),
          severity: "warning",
          nodeId: node.id,
          title: "Function has many external calls",
          description: `"${node.name}" makes ${calls.length} external calls. This suggests tight coupling.`,
          recommendation:
            "Extract groups of related calls into dedicated intermediate nodes.",
          effort: "medium"
        });
      }
    }
  });

  return suggestions;
};

/**
 * Finds duplicate node names (ignoring case) — often copy-paste residue.
 */
const analyzeDuplicateNames = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  const suggestions: RefactorSuggestion[] = [];
  const nameCount = new Map<string, { id: string; name: string }[]>();

  graph.nodes.forEach((n) => {
    const key = n.name.toLowerCase();
    if (!nameCount.has(key)) nameCount.set(key, []);
    nameCount.get(key)!.push({ id: n.id, name: n.name });
  });

  let dupIdx = 0;
  nameCount.forEach((entries, _key) => {
    if (entries.length > 1) {
      const ids = entries.map((e) => e.id).join(", ");
      suggestions.push({
        id: id("dup-name", dupIdx++),
        severity: "warning",
        title: "Duplicate node names",
        description: `Nodes ${ids} share the same normalized name. Verify this is intentional.`,
        recommendation:
          "Ensure each node has a unique name. Copy-paste artifacts should be renamed or merged.",
        effort: "low"
      });
    }
  });

  return suggestions;
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Analyze a blueprint graph and return prioritized refactoring suggestions.
 * Each suggestion carries an effort estimate to help prioritize fixes.
 */
export const analyzeAndSuggestRefactors = (
  graph: BlueprintGraph
): RefactorSuggestion[] => {
  return [
    ...analyzeContractCompleteness(graph),
    ...analyzeOrphanNodes(graph),
    ...analyzeCycles(graph),
    ...analyzeNodeComplexity(graph),
    ...analyzeDuplicateNames(graph)
  ].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

// ---------------------------------------------------------------------------
// Code-level refactoring analyzer
// ---------------------------------------------------------------------------

const NESTING_THRESHOLD = 3;
const LONG_FUNCTION_LINES = 50;
const MAGIC_NUMBER_REGEX = /\b([1-9]\d*|0[0-9]|[1-9]\d*\.\d+)\b/;
const ALLOWED_MAGIC = new Set([0, 1, -1]);

const detectDeepNesting = (code: string): RefactorIssue[] => {
  const issues: RefactorIssue[] = [];
  const lines = code.split('\n');
  let maxNesting = 0;
  let maxNestingLine = 0;
  let currentNesting = 0;

  lines.forEach((line, idx) => {
    const ifCount = (line.match(/\bif\b/g) || []).length;
    if (ifCount > 0) {
      currentNesting += ifCount;
      if (currentNesting > maxNesting) {
        maxNesting = currentNesting;
        maxNestingLine = idx + 1;
      }
    } else if (line.includes('}')) {
      currentNesting = Math.max(0, currentNesting - 1);
    }
  });

  if (maxNesting >= NESTING_THRESHOLD) {
    issues.push({
      type: 'deep-nesting',
      message: `Contains ${maxNesting} levels of nested if statements`,
      line: maxNestingLine,
    });
  }

  return issues;
};

const detectLongFunction = (code: string): RefactorIssue[] => {
  const issues: RefactorIssue[] = [];
  const lines = code.split('\n').length;

  if (lines > LONG_FUNCTION_LINES) {
    issues.push({
      type: 'long-function',
      message: `Function body is ${lines} lines (threshold: ${LONG_FUNCTION_LINES})`,
      line: 1,
    });
  }

  return issues;
};

const detectMagicNumbers = (code: string): RefactorIssue[] => {
  const issues: RefactorIssue[] = [];
  const lines = code.split('\n');

  lines.forEach((line, idx) => {
    const match = line.match(MAGIC_NUMBER_REGEX);
    if (match) {
      const num = parseFloat(match[1]);
      if (!ALLOWED_MAGIC.has(num) && !line.includes('const ') && !line.includes('let ')) {
        issues.push({
          type: 'magic-number',
          message: `Hardcoded magic number ${match[1]} at line ${idx + 1}`,
          line: idx + 1,
        });
      }
    }
  });

  return issues;
};

const detectGlobalState = (code: string): RefactorIssue[] => {
  const issues: RefactorIssue[] = [];
  const lines = code.split('\n');
  const isOutsideFunction = (lineNum: number, funcStart: number, funcEnd: number): boolean => {
    return lineNum < funcStart || lineNum > funcEnd;
  };

  let funcStart = -1;
  let funcEnd = -1;
  let braceCount = 0;

  // Find function boundaries
  lines.forEach((line, idx) => {
    if (line.match(/\bfunction\s+\w+/)) {
      funcStart = idx;
      braceCount = 0;
    }
    if (funcStart >= 0 && funcEnd < 0) {
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            funcEnd = idx;
            break;
          }
        }
      }
    }
  });

  // Look for mutable outside variable
  lines.forEach((line, idx) => {
    if (line.match(/^\s*(let|var)\s+\w+\s*=/)) {
      if (funcStart < 0 || idx < funcStart || idx > funcEnd) {
        issues.push({
          type: 'global-state',
          message: `Mutable variable declared outside function scope at line ${idx + 1}`,
          line: idx + 1,
        });
      }
    }
  });

  return issues;
};

/**
 * Analyze code string and return refactoring issues and suggestions.
 * Detects: deep nesting, long functions, magic numbers, global mutable state.
 */
export const suggestRefactors = (code: string, _nodeType: string): CodeAnalysisResult => {
  const issues: RefactorIssue[] = [
    ...detectDeepNesting(code),
    ...detectLongFunction(code),
    ...detectMagicNumbers(code),
    ...detectGlobalState(code),
  ];

  const suggestions: string[] = [];

  if (issues.some((i) => i.type === 'deep-nesting')) {
    suggestions.push('Consider extracting nested conditionals into a separate function');
  }
  if (issues.some((i) => i.type === 'long-function')) {
    suggestions.push('Split this function into smaller, focused functions');
  }
  if (issues.some((i) => i.type === 'magic-number')) {
    issues
      .filter((i) => i.type === 'magic-number')
      .forEach((i) => {
        const num = i.message.match(/\d+/)?.[0];
        if (num) {
          suggestions.push(`Replace magic number ${num} with a named constant`);
        }
      });
  }
  if (issues.some((i) => i.type === 'global-state')) {
    suggestions.push('Pass mutable state as a parameter instead of using global variables');
  }

  return { issues, suggestions };
};
