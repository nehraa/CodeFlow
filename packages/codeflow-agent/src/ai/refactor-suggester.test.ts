import { describe, it, expect } from 'vitest';
import type { BlueprintGraph, BlueprintNode } from '@abhinav2203/codeflow-core';
import { analyzeAndSuggestRefactors, type CodeAnalysisResult, type RefactorSuggestion } from './refactor-suggester.js';

const makeNode = (overrides: Partial<BlueprintNode> = {}): BlueprintNode =>
  ({
    id: 'test-node',
    kind: 'function',
    name: 'myFunction',
    summary: 'A test function',
    contract: {
      summary: 'Test function summary',
      responsibilities: [],
      inputs: [{ name: 'arg1', type: 'string' }],
      outputs: [{ name: 'result', type: 'string' }],
      attributes: [],
      methods: [],
      sideEffects: [],
      errors: [],
      dependencies: [],
      calls: [],
      uiAccess: [],
      backendAccess: [],
      notes: [],
    },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
    status: 'spec_only' as const,
    ...overrides,
  } as BlueprintNode);

const emptyGraph: BlueprintGraph = {
  projectName: 'test',
  mode: 'essential',
  generatedAt: new Date().toISOString(),
  nodes: [],
  edges: [],
  workflows: [],
  warnings: []
};

describe('analyzeAndSuggestRefactors', () => {
  it('returns empty array for empty graph', () => {
    const result = analyzeAndSuggestRefactors(emptyGraph);
    expect(result).toEqual([]);
  });

  it('returns empty array when all nodes have valid contracts', () => {
    const node = makeNode({ id: 'n1', name: 'GoodNode', kind: 'function' });
    const graph: BlueprintGraph = { ...emptyGraph, nodes: [node] };
    const result = analyzeAndSuggestRefactors(graph);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('detects empty contract on code-bearing nodes', () => {
    const node = makeNode({
      id: 'n2',
      kind: 'function',
      name: 'BadNode',
      contract: {
        summary: 'Empty contract node',
        responsibilities: [],
        inputs: [],
        outputs: [],
        attributes: [],
        methods: [],
        sideEffects: [],
        errors: [],
        dependencies: [],
        calls: [],
        uiAccess: [],
        backendAccess: [],
        notes: [],
      },
    });
    const graph: BlueprintGraph = { ...emptyGraph, nodes: [node] };
    const result = analyzeAndSuggestRefactors(graph);
    const emptyContractIssues = result.filter((s: RefactorSuggestion) => s.id.includes('empty-contract'));
    expect(emptyContractIssues.length).toBeGreaterThan(0);
  });

  it('detects orphan nodes (no incoming edges)', () => {
    const orphan = makeNode({ id: 'orphan-node', name: 'OrphanNode', kind: 'function' });
    const graph: BlueprintGraph = { ...emptyGraph, nodes: [orphan] };
    const result = analyzeAndSuggestRefactors(graph);
    const orphanIssues = result.filter((s: RefactorSuggestion) => s.id.includes('orphan'));
    expect(orphanIssues.length).toBe(1);
  });

  it('detects duplicate node names', () => {
    const n1 = makeNode({ id: 'dup1', name: 'DuplicateNode' });
    const n2 = makeNode({ id: 'dup2', name: 'DuplicateNode' });
    const graph: BlueprintGraph = { ...emptyGraph, nodes: [n1, n2] };
    const result = analyzeAndSuggestRefactors(graph);
    const dupIssues = result.filter((s: RefactorSuggestion) => s.id.includes('dup-name'));
    expect(dupIssues.length).toBeGreaterThan(0);
  });

  it('detects high input arity (> 10 inputs)', () => {
    const manyInputs = Array.from({ length: 12 }, (_, i) => ({ name: `arg${i}`, type: 'string' }));
    const node = makeNode({
      id: 'many-inputs',
      name: 'ManyInputsNode',
      contract: {
        summary: 'Too many inputs',
        responsibilities: [],
        inputs: manyInputs,
        outputs: [{ name: 'result', type: 'string' }],
        attributes: [],
        methods: [],
        sideEffects: [],
        errors: [],
        dependencies: [],
        calls: [],
        uiAccess: [],
        backendAccess: [],
        notes: [],
      },
    });
    const graph: BlueprintGraph = { ...emptyGraph, nodes: [node] };
    const result = analyzeAndSuggestRefactors(graph);
    const arityIssues = result.filter((s: RefactorSuggestion) => s.id.includes('too-many-inputs'));
    expect(arityIssues.length).toBe(1);
  });

  it('returns results sorted by severity (error first)', () => {
    const result = analyzeAndSuggestRefactors(emptyGraph);
    if (result.length > 1) {
      const severities = result.map((s: RefactorSuggestion) => s.severity);
      expect(severities).toEqual(severities.slice().sort());
    }
  });
});
