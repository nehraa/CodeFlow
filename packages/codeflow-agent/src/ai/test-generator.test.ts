import { describe, it, expect } from 'vitest';
import type { BlueprintNode, BlueprintGraph } from '@abhinav2203/codeflow-core';
import {
  generateTestContent,
  generatePythonPytest,
  generateGoTest,
  generateRustTest,
  generateTypeScriptTest,
} from './test-generator.js';

const makeNode = (overrides: Partial<BlueprintNode> & { language?: string } = {}): BlueprintNode =>
  ({
    id: 'test-node',
    kind: 'function',
    name: 'myFunction',
    summary: 'A test function',
    contract: {
      summary: 'Test function summary',
      responsibilities: [],
      inputs: [
        { name: 'arg1', type: 'string' },
        { name: 'arg2', type: 'number' },
      ],
      outputs: [{ name: 'result', type: 'string', description: 'The result' }],
      attributes: [],
      methods: [],
      sideEffects: [],
      errors: ['ValidationError'],
      dependencies: [],
      calls: [{ target: 'validate', kind: 'calls', description: 'Validates input' }],
      uiAccess: [],
      backendAccess: [],
      notes: [],
    },
    sourceRefs: [],
    generatedRefs: [],
    traceRefs: [],
    status: 'spec_only' as const,
    ...overrides,
  } as BlueprintNode & { language?: string });

const emptyGraph: BlueprintGraph = {
  projectName: 'test',
  mode: 'essential',
  generatedAt: new Date().toISOString(),
  nodes: [],
  edges: [],
  workflows: [],
  warnings: [],
};

describe('generateTypeScriptTest', () => {
  it('generates a describe block with it for happy path', () => {
    const node = makeNode({ name: 'myFunction' });
    const result = generateTypeScriptTest(node, 'unit');
    expect(result).toContain("describe('Function myFunction'");
    expect(result).toContain("it('accepts a representative input'");
  });

  it('includes error test from contract.errors', () => {
    const node = makeNode();
    const result = generateTypeScriptTest(node, 'unit');
    expect(result).toContain('ValidationError');
  });

  it('handles void return type', () => {
    const node = makeNode({
      name: 'voidFunction',
      contract: {
        summary: 'Void function',
        responsibilities: [],
        inputs: [],
        outputs: [{ name: 'result', type: 'void' }],
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
    const result = generateTypeScriptTest(node, 'unit');
    expect(result).toContain("describe('Function voidFunction'");
  });
});

describe('generatePythonPytest', () => {
  it('generates pytest-style test function', () => {
    const node = makeNode({ name: 'my_function' });
    const result = generatePythonPytest(node, 'unit');
    expect(result).toContain('def test_my_function(');
    expect(result).toContain('pass');
  });

  it('includes error test stub', () => {
    const node = makeNode();
    const result = generatePythonPytest(node, 'unit');
    expect(result).toContain('def test_my');
    expect(result).toContain('pass');
  });
});

describe('generateGoTest', () => {
  it('generates go test function', () => {
    const node = makeNode({ name: 'MyFunction' });
    const result = generateGoTest(node, 'unit');
    expect(result).toContain('func TestMyFunction(t *testing.T)');
    expect(result).toContain('t.Error');
  });
});

describe('generateRustTest', () => {
  it('generates rust test function', () => {
    const node = makeNode({ name: 'my_function' });
    const result = generateRustTest(node, 'unit');
    expect(result).toContain('#[test]');
    expect(result).toContain('fn my_function_test');
  });
});

describe('generateTestContent', () => {
  it('returns test content for function node', () => {
    const node = makeNode({ language: 'typescript' });
    const result = generateTestContent(node, emptyGraph, { language: 'typescript', framework: 'jest', testStyle: 'unit' });
    expect(result).toContain('describe');
    expect(result).toContain("it('accepts a representative input'");
  });

  it('returns null for module kind nodes', () => {
    const node = makeNode({ kind: 'module' });
    const result = generateTestContent(node, emptyGraph, { language: 'typescript', framework: 'jest', testStyle: 'unit' });
    expect(result).toBeNull();
  });

  it('includes error tests when contract.errors is defined', () => {
    const node = makeNode();
    const result = generateTestContent(node, emptyGraph, { language: 'typescript', framework: 'jest', testStyle: 'unit' });
    expect(result).toContain('should throw or reject on ValidationError');
  });

  it('returns python content for python language', () => {
    const node = makeNode({ language: 'python' });
    const result = generateTestContent(node, emptyGraph, { language: 'python', framework: 'pytest', testStyle: 'unit' });
    expect(result).toContain('def test_');
  });

  it('returns rust content for rust language', () => {
    const node = makeNode({ language: 'rust' });
    const result = generateTestContent(node, emptyGraph, { language: 'rust', framework: 'cargo', testStyle: 'unit' });
    expect(result).toContain('#[test]');
  });
});
