/**
 * Test content generation from blueprint contracts.
 *
 * Generates test scaffolding for multiple languages and frameworks:
 * - TypeScript/Jest, Python/pytest, Go/testing, Rust/cargo
 */

import type { BlueprintGraph, BlueprintNode } from '@abhinav2203/codeflow-core';
import { isCodeBearingNode } from './scaffold-utils.js';

const INDENT = '  ';

/** Returns "describe" block title for a node. */
const testBlockTitle = (node: BlueprintNode): string =>
  `${node.kind} ${node.name}`;

/** Returns the runtime export name for a node (function / class name). */
const runtimeName = (node: BlueprintNode): string => {
  if (node.kind === 'function' || node.kind === 'api') {
    return node.name.split('.').pop()!.replace(/[^a-zA-Z0-9_]/g, '');
  }
  if (node.kind === 'class') {
    const camel = node.name.replace(/[^a-zA-Z0-9_$]+/g, ' ').trim();
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }
  return node.name;
};

// ---------------------------------------------------------------------------
// Type utilities
// ---------------------------------------------------------------------------

/** Produce a minimal valid input value for a TypeScript type string. */
const sampleInputValue = (type: string): string => {
  const t = type.trim();
  if (t === 'string') return '"test_value"';
  if (t === 'number' || t === 'bigint') return '42';
  if (t === 'boolean') return 'true';
  if (t === 'null' || t === 'undefined') return 'null';
  if (t.startsWith('Promise<')) return 'Promise.resolve(undefined)';
  if (t.startsWith('Array<') || t.endsWith('[]')) return '[]';
  if (t === 'unknown' || t === 'any') return 'undefined';
  return 'undefined';
};

/** Build actual input argument map for a node's inputs. */
const inputArgs = (node: BlueprintNode): string[] =>
  (node.contract?.inputs ?? []).map((f) => {
    const val = sampleInputValue(f.type ?? 'unknown');
    return `${f.name}: ${val}`;
  });

/** Build a fake (non-throwing) input object for error-path testing. */
const errorInputArgs = (node: BlueprintNode): string[] =>
  (node.contract?.inputs ?? []).map((f) => {
    const t = (f.type ?? '').toLowerCase();
    if (t === 'string') return `${f.name}: ""`;
    if (t === 'number') return `${f.name}: -1`;
    if (t === 'boolean') return `${f.name}: false`;
    return `${f.name}: undefined`;
  });

// ---------------------------------------------------------------------------
// TypeScript / Jest
// ---------------------------------------------------------------------------

/**
 * Generate TypeScript/Jest test content.
 */
export const generateTypeScriptTest = (
  node: BlueprintNode,
  _testStyle: 'unit' | 'integration'
): string => {
  const name = runtimeName(node);
  const args = inputArgs(node).join(', ');
  const callExpr = `${name}(${args})`;
  const errorTests = (node.contract?.errors ?? []).map(
    (error) =>
      `it('should throw or reject on ${error}', async () => {
  ${INDENT}await expect(${callExpr}).rejects.toThrow();
});`
  );

  return `describe('Function ${name}', () => {
  it('accepts a representative input', () => {
    // TODO: implement test
  });
${errorTests.length ? '\n' + errorTests.join('\n') + '\n' : ''}});
`;
};

// ---------------------------------------------------------------------------
// Python / pytest
// ---------------------------------------------------------------------------

const snakeCase = (name: string): string =>
  name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Generate Python/pytest test content.
 */
export const generatePythonPytest = (
  node: BlueprintNode,
  _testStyle: 'unit' | 'integration'
): string => {
  const name = snakeCase(runtimeName(node));
  const args = (node.contract?.inputs ?? [])
    .map((f) => `${f.name}=None`)
    .join(', ');

  return `def test_${name}(${args}):
    # TODO: implement test
    pass
`;
};

// ---------------------------------------------------------------------------
// Go / testing
// ---------------------------------------------------------------------------

const titleCase = (name: string): string =>
  name
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

/**
 * Generate Go test content.
 */
export const generateGoTest = (
  node: BlueprintNode,
  _testStyle: 'unit' | 'integration'
): string => {
  const name = titleCase(runtimeName(node));

  return `func Test${name}(t *testing.T) {
	// TODO: implement test
	t.Error("test not implemented")
}
`;
};

// ---------------------------------------------------------------------------
// Rust / cargo
// ---------------------------------------------------------------------------

/**
 * Generate Rust test content.
 */
export const generateRustTest = (
  node: BlueprintNode,
  _testStyle: 'unit' | 'integration'
): string => {
  const name = snakeCase(runtimeName(node));

  return `#[test]
fn ${name}_test() {
    // TODO: implement test
    panic!("test not implemented")
}
`;
};

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export interface TestGeneratorOptions {
  language: string;
  framework: string;
  testStyle: 'unit' | 'integration';
}

/**
 * Generates a complete test file content for a blueprint node.
 * Returns null for non-code-bearing nodes.
 */
export const generateTestContent = (
  node: BlueprintNode,
  _graph: BlueprintGraph,
  options: TestGeneratorOptions = { language: 'typescript', framework: 'jest', testStyle: 'unit' }
): string | null => {
  if (!isCodeBearingNode(node)) {
    return null;
  }

  if (options.language === 'python' && options.framework === 'pytest') {
    return generatePythonPytest(node, options.testStyle);
  }

  if (options.language === 'go' && options.framework === 'testing') {
    return generateGoTest(node, options.testStyle);
  }

  if (options.language === 'rust' && options.framework === 'cargo') {
    return generateRustTest(node, options.testStyle);
  }

  // Default: TypeScript/Jest
  return generateTypeScriptTest(node, options.testStyle);
};
