import { describe, it, expect } from 'vitest';
import type { BlueprintNode, BlueprintGraph } from '@abhinav2203/codeflow-core';
import {
  generateNodeMarkdown as generateNodeDocumentation,
  generateMarkdownDocs,
  generateOpenApiSpec,
} from './doc-generator.js';

const makeNode = (overrides: Partial<BlueprintNode> = {}): BlueprintNode =>
  ({
    id: 'test-node',
    kind: 'function',
    name: 'myFunction',
    summary: 'A test function',
    contract: {
      summary: 'Test function summary',
      responsibilities: ['Handle data processing', 'Emit events on completion'],
      inputs: [
        { name: 'inputData', type: 'string', description: 'The input data to process' },
        { name: 'options', type: 'object', description: 'Processing options' },
      ],
      outputs: [
        { name: 'result', type: 'string', description: 'The processed result' },
      ],
      attributes: [],
      methods: [],
      sideEffects: [],
      errors: ['ValidationError', 'ProcessingError'],
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
  } as BlueprintNode);

describe('generateNodeDocumentation', () => {
  it('generates markdown documentation for a function node', () => {
    const node = makeNode();
    const result = generateNodeDocumentation(node);
    expect(result).toContain('# myFunction');
    expect(result).toContain('## Metadata');
    expect(result).toContain('Blueprint ID');
    expect(result).toContain('Function');
  });

  it('includes inputs table when inputs are defined', () => {
    const node = makeNode();
    const result = generateNodeDocumentation(node);
    expect(result).toContain('## Inputs');
    expect(result).toContain('inputData');
  });

  it('includes outputs table when outputs are defined', () => {
    const node = makeNode();
    const result = generateNodeDocumentation(node);
    expect(result).toContain('## Outputs');
    expect(result).toContain('result');
  });

  it('includes responsibilities when defined', () => {
    const node = makeNode();
    const result = generateNodeDocumentation(node);
    expect(result).toContain('## Responsibilities');
    expect(result).toContain('Handle data processing');
  });

  it('returns null for module kind nodes', () => {
    const node = makeNode({ kind: 'module' });
    const result = generateNodeDocumentation(node);
    expect(result).toBeNull();
  });
});

describe('generateOpenApiSpec', () => {
  it('generates OpenAPI spec for api nodes', () => {
    const node = makeNode({ kind: 'api', name: 'My API Endpoint' });
    const result = generateOpenApiSpec(node);
    expect(result).toContain('openapi: 3.0.0');
    expect(result).toContain('info:');
    expect(result).toContain('paths:');
  });

  it('returns null for non-api nodes', () => {
    const node = makeNode({ kind: 'function' });
    const result = generateOpenApiSpec(node);
    expect(result).toBeNull();
  });

  it('includes path for api nodes', () => {
    const node = makeNode({ kind: 'api', name: 'user-create' });
    const result = generateOpenApiSpec(node);
    expect(result).toContain('/user-create');
    expect(result).toContain('summary:');
  });

  it('includes 501 response for scaffold', () => {
    const node = makeNode({ kind: 'api', name: 'test-api' });
    const result = generateOpenApiSpec(node);
    expect(result).toContain('501');
    expect(result).toContain('Not implemented (scaffold)');
  });
});

describe('generateMarkdownDocs', () => {
  it('is an alias for generateNodeMarkdown', () => {
    const node = makeNode();
    const result1 = generateNodeDocumentation(node);
    const result2 = generateMarkdownDocs(node);
    expect(result1).toEqual(result2);
  });
});
