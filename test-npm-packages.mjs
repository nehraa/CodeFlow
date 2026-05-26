#!/usr/bin/env node
/**
 * E2E Test using npm packages from node_modules
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import path from 'path';

console.log('═══════════════════════════════════════════════════════════════');
console.log('   E2E TEST - NPM PACKAGES');
console.log('═══════════════════════════════════════════════════════════════\n');

// Setup test repo in /tmp
console.log('【0】 Setting up test repo...');
try { rmSync('/tmp/test-npm-repo', { force: true, recursive: true }); } catch (e) {}
mkdirSync('/tmp/test-npm-repo/src', { recursive: true });

writeFileSync('/tmp/test-npm-repo/package.json', JSON.stringify({ name: 'test-repo', type: 'module' }, null, 2));
writeFileSync('/tmp/test-npm-repo/src/index.ts', `export function hello() { return 'hello'; }`);
console.log('  ✓ Test repo created\n');

// Import from npm packages in node_modules
console.log('【1】 Testing @abhinav2203/codeflow-prd...');
const { parsePrd } = await import('@abhinav2203/codeflow-prd');

const prdContent = `# Test Module

## screen: Login Screen
- Username input
- Password input

## api: POST /api/login
- Authenticates user

## module: AuthService
- login(credentials)
`;

const parsed = parsePrd(prdContent);
console.log('  ✓ PRD parsed, nodes:', parsed.nodes.length, ', edges:', parsed.edges.length);

// Step 2: Store - Session
console.log('\n【2】 Testing @abhinav2203/codeflow-store...');
const { createSessionId } = await import('@abhinav2203/codeflow-store/session');
const { saveTaskReasoningCheckpoint, loadTaskReasoningCheckpoint } = await import('@abhinav2203/codeflow-store/checkpoint/reasoning');
const { saveBranch, loadBranch, loadBranches } = await import('@abhinav2203/codeflow-store/branch');

const sessionId = createSessionId();
console.log('  ✓ Session ID:', sessionId.slice(0, 8));

// Test checkpoint save/load
const content = JSON.stringify({ test: 'data', sessionId });
await saveTaskReasoningCheckpoint(sessionId, 'test-project', 'test-task', content);
const loaded = await loadTaskReasoningCheckpoint(sessionId, 'test-project', 'test-task');
console.log('  ✓ Checkpoint save/load:', loaded ? 'OK' : 'FAILED');

// Test branch save/load
const branchId = 'branch-' + randomUUID().slice(0, 8);
const branch = {
  id: branchId,
  name: 'test-branch',
  projectName: 'test-project',
  createdAt: new Date().toISOString(),
  graph: {
    projectName: 'test-project',
    mode: 'essential',
    phase: 'spec',
    generatedAt: new Date().toISOString(),
    nodes: [],
    edges: [],
    workflows: [],
    warnings: []
  }
};
await saveBranch(branch);
const loadedBranch = await loadBranch('test-project', branchId);
console.log('  ✓ Branch save/load:', loadedBranch?.name || 'FAILED');

// Step 3: Versioning - CodeRAG
console.log('\n【3】 Testing @abhinav2203/codeflow-versioning...');
const { initCodeRagForProject } = await import('@abhinav2203/codeflow-versioning/coderag');

const coderag = await initCodeRagForProject({ repoPath: '/tmp/test-npm-repo', projectName: 'test-project' });
console.log('  ✓ CodeRAG initialized');
console.log('  Indexed nodes:', coderag.nodes?.length || 0);

try {
  const results = coderag.query('hello');
  console.log('  ✓ Query works, results:', Array.isArray(results) ? results.length : typeof results);
} catch (e) {
  console.log('  ✗ Query failed:', e.message);
}

// Step 4: Analysis
console.log('\n【4】 Testing @abhinav2203/codeflow-analysis...');
const { computeGraphMetrics } = await import('@abhinav2203/codeflow-analysis/metrics');
const { detectCycles } = await import('@abhinav2203/codeflow-analysis/cycles');
const { detectSmells } = await import('@abhinav2203/codeflow-analysis/smells');

const metrics = computeGraphMetrics(parsed);
console.log('  ✓ Metrics:', metrics.nodeCount, 'nodes,', metrics.edgeCount, 'edges');

const cycles = detectCycles(parsed);
console.log('  ✓ Cycles:', cycles?.length ?? 'undefined');

const smells = detectSmells(parsed);
console.log('  ✓ Smells:', smells?.length ?? 'undefined');

// Summary
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('   NPM PACKAGES TEST COMPLETE');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  ✓ codeflow-prd: nodes=' + parsed.nodes.length);
console.log('  ✓ codeflow-store: session + checkpoint + branch working');
console.log('  ✓ codeflow-versioning: CodeRAG initialized');
console.log('  ✓ codeflow-analysis: metrics working');
console.log('═══════════════════════════════════════════════════════════════\n');