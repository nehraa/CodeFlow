import { describe, it, expect } from 'vitest';
import { detectTargetLanguage, generatePythonScaffold, generateGoScaffold, generateRustScaffold, generateMultiLanguageCode, } from './multi-language-codegen.js';
const makeNode = (overrides = {}) => ({
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
    status: 'spec_only',
    ...overrides,
});
const emptyGraph = {
    projectName: 'test',
    mode: 'essential',
    generatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    workflows: [],
    warnings: []
};
describe('detectTargetLanguage', () => {
    it('returns node.language when explicitly set', () => {
        const node = makeNode({ language: 'python' });
        expect(detectTargetLanguage(node)).toBe('python');
    });
    it('returns node.language when set to go', () => {
        const node = makeNode({ language: 'go' });
        expect(detectTargetLanguage(node)).toBe('go');
    });
    it('returns node.language when set to rust', () => {
        const node = makeNode({ language: 'rust' });
        expect(detectTargetLanguage(node)).toBe('rust');
    });
    it('defaults to typescript when language is not set', () => {
        const node = makeNode({ language: undefined });
        expect(detectTargetLanguage(node)).toBe('typescript');
    });
    it('detects python from .py path extension', () => {
        const node = makeNode({ path: 'src/utils/helper.py' });
        expect(detectTargetLanguage(node)).toBe('python');
    });
    it('detects go from .go path extension', () => {
        const node = makeNode({ path: 'internal/service.go' });
        expect(detectTargetLanguage(node)).toBe('go');
    });
    it('detects rust from .rs path extension', () => {
        const node = makeNode({ path: 'src/main.rs' });
        expect(detectTargetLanguage(node)).toBe('rust');
    });
});
describe('generatePythonScaffold', () => {
    it('generates a python function scaffold', () => {
        const node = makeNode({ name: 'my_function' });
        const result = generatePythonScaffold(node);
        expect(result).toContain('def my_function(');
        expect(result).toContain('raise NotImplementedError');
    });
    it('includes docstring with summary', () => {
        const node = makeNode({ name: 'calculate_total' });
        const result = generatePythonScaffold(node);
        expect(result).toContain('"""');
        expect(result).toContain('A test function');
    });
    it('handles empty inputs', () => {
        const node = makeNode({
            name: 'no_args',
            contract: {
                summary: 'No args function',
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
        const result = generatePythonScaffold(node);
        expect(result).toContain('def no_args()');
    });
});
describe('generateGoScaffold', () => {
    it('generates a go function scaffold', () => {
        const node = makeNode({ name: 'MyFunction' });
        const result = generateGoScaffold(node);
        expect(result).toContain('func MyFunction(');
        expect(result).toContain('errors.New');
    });
    it('includes comment with summary', () => {
        const node = makeNode({ name: 'CalculateTotal' });
        const result = generateGoScaffold(node);
        expect(result).toContain('// A test function');
    });
    it('handles empty inputs', () => {
        const node = makeNode({
            name: 'NoArgs',
            contract: {
                summary: 'No args function',
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
        const result = generateGoScaffold(node);
        expect(result).toContain('func NoArgs()');
    });
});
describe('generateRustScaffold', () => {
    it('generates a rust function scaffold', () => {
        const node = makeNode({ name: 'my_function' });
        const result = generateRustScaffold(node);
        expect(result).toContain('fn my_function(');
        expect(result).toContain('todo!');
    });
    it('includes doc comment with summary', () => {
        const node = makeNode({ name: 'calculate_total' });
        const result = generateRustScaffold(node);
        expect(result).toContain('/// A test function');
    });
    it('handles empty inputs', () => {
        const node = makeNode({
            name: 'no_args',
            contract: {
                summary: 'No args function',
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
        const result = generateRustScaffold(node);
        expect(result).toContain('fn no_args()');
    });
});
describe('generateMultiLanguageCode', () => {
    it('dispatches to python for python language', () => {
        const node = makeNode({ language: 'python' });
        const result = generateMultiLanguageCode(node, emptyGraph);
        expect(result).toContain('def ');
        expect(result).toContain('raise NotImplementedError');
    });
    it('dispatches to go for go language', () => {
        const node = makeNode({ language: 'go' });
        const result = generateMultiLanguageCode(node, emptyGraph);
        expect(result).toContain('func ');
        expect(result).toContain('errors.New');
    });
    it('dispatches to rust for rust language', () => {
        const node = makeNode({ language: 'rust' });
        const result = generateMultiLanguageCode(node, emptyGraph);
        expect(result).toContain('fn ');
        expect(result).toContain('todo!');
    });
    it('dispatches to typescript by default', () => {
        const node = makeNode({ language: undefined });
        const result = generateMultiLanguageCode(node, emptyGraph);
        expect(result).toContain('export function');
        expect(result).toContain('throw new Error');
    });
    it('respects path extension when language is not set', () => {
        const node = makeNode({ language: undefined, path: 'lib/main.go' });
        const result = generateMultiLanguageCode(node, emptyGraph);
        expect(result).toContain('func ');
    });
});
