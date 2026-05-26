/**
 * CODEFLOW FULL PIPELINE END-TO-END DEMO
 */

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 1: PRD GENERATION (codeflow-prd)                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { generatePRD } = await import('./packages/codeflow-prd/dist/index.js');

const prdResult = generatePRD({
  projectName: 'user-auth-service',
  description: 'A microservice that handles user authentication with JWT tokens, refresh tokens, and social login providers (Google, GitHub). Includes rate limiting, account lockout after failed attempts, and MFA support.',
  techStack: ['TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Redis']
});

console.log('✓ PRD Generated:', prdResult.projectName);
console.log('  Features:', (prdResult.features || []).length || 0);
console.log('  Risks:', (prdResult.risks || []).length || 0);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 2: SESSION & STATE (codeflow-store)                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { createSession } = await import('./packages/codeflow-store/dist/session/index.js');
const { createRun, updateRunStatus } = await import('./packages/codeflow-store/dist/run/index.js');
const { createBranch } = await import('./packages/codeflow-store/dist/branch/index.js');

const runId = 'run-' + Date.now();
const projectName = 'user-auth-service';

const session = await createSession({ projectName, runId });
console.log('✓ Session created:', session.id);

const run = await createRun({ runId, projectName, status: 'in_progress' });
console.log('✓ Run created:', run.runId);

const featureBranch = await createBranch({ name: 'feature/jwt-refresh', parentRunId: runId, projectName });
console.log('✓ Feature branch created:', featureBranch.name);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 3: REASONING CHECKPOINTS (codeflow-store)            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { saveTaskReasoningCheckpoint, loadReasoningForRun } = 
  await import('./packages/codeflow-store/dist/checkpoint/reasoning.js');

await saveTaskReasoningCheckpoint(runId, projectName, 'task-1', 
  'Analyzing JWT token structure. Need to support access tokens (15min) and refresh tokens (7 days). Using RS256 for signing.'
);
console.log('✓ Checkpoint 1 saved');

await saveTaskReasoningCheckpoint(runId, projectName, 'task-2',
  'Designing database schema for users table with columns: id, email, password_hash, mfa_enabled, mfa_secret, failed_attempts, locked_until'
);
console.log('✓ Checkpoint 2 saved');

const recovered = await loadReasoningForRun(runId, projectName);
console.log('✓ Recovered', recovered.length, 'checkpoints');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 4: BLUEPRINT GENERATION (codeflow-agent + MiniMax)   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { requestMiniMaxChatCompletion } = await import('./packages/codeflow-agent/dist/ai/minimax-client.js');

const API_KEY = 'sk-cp-KjobHFSNe1A5LaEtTY0qrBV5l85bitrDDWkjO4VEtsGd6h8uTnRmbcuEQflj1FXbUwFX2L9S1Qt5_M-dqpFnX7qMGg7GUtGTfYp5EJJ05MVyuLN7N5WWoyA';

const blueprintPrompt = `Generate a blueprint JSON for a user authentication service:
- JWT access tokens (15 min expiry)
- Refresh tokens (7 day expiry)  
- Password hashing with bcrypt
- Rate limiting: 5 attempts per 15 min

Return ONLY this JSON: {"nodes":[{"id":"name","kind":"module|service|repository","summary":"desc"}],"edges":[{"source":"id1","target":"id2","kind":"contains|uses"}]}`;

console.log('  Generating blueprint with MiniMax-M2.7...');
const blueprintResult = await requestMiniMaxChatCompletion({
  apiKey: API_KEY,
  messages: [{ role: 'user', content: blueprintPrompt }],
  model: 'MiniMax-M2.7',
  maxTokens: 2048,
  timeout: 30000
});
console.log('✓ Blueprint received (' + blueprintResult.length + ' chars)');
console.log('  Preview:', blueprintResult.substring(0, 150) + '...');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 5: CODE GENERATION (codeflow-agent + MiniMax)        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const codeGenPrompt = `Generate a TypeScript JWT service class with:
- generateAccessToken(userId: string): Promise<string>
- generateRefreshToken(userId: string): Promise<string>  
- verifyAccessToken(token: string): Promise<object>
- refreshAccessToken(refreshToken: string): Promise<string>

Return JSON: {"code":"class JWTService { ... }","summary":"JWT token service"}`;

console.log('  Generating code with MiniMax...');
const codeResult = await requestMiniMaxChatCompletion({
  apiKey: API_KEY,
  messages: [{ role: 'user', content: codeGenPrompt }],
  model: 'MiniMax-M2.7',
  maxTokens: 4096,
  timeout: 30000
});
console.log('✓ Code generated (' + codeResult.length + ' chars)');
console.log('  Preview:', codeResult.substring(0, 200) + '...');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 6: CODE ANALYSIS (codeflow-analysis)                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { detectCycles } = await import('./packages/codeflow-analysis/dist/cycles.js');
const { detectSmells } = await import('./packages/codeflow-analysis/dist/smells.js');
const { computeGraphMetrics } = await import('./packages/codeflow-analysis/dist/metrics.js');

const sampleNodes = [
  { id: 'auth', name: 'AuthModule', kind: 'module', summary: 'Main auth' },
  { id: 'jwt', name: 'JWTService', kind: 'service', summary: 'JWT handling' },
  { id: 'user', name: 'UserRepository', kind: 'repository', summary: 'User DB' },
  { id: 'cache', name: 'RedisCache', kind: 'module', summary: 'Redis cache' }
];
const sampleEdges = [
  { source: 'auth', target: 'jwt', kind: 'contains' },
  { source: 'auth', target: 'user', kind: 'contains' },
  { source: 'jwt', target: 'cache', kind: 'uses' }
];

console.log('  Analyzing graph with', sampleNodes.length, 'nodes...');

const cycleReport = detectCycles(sampleNodes, sampleEdges.map(e => ({ from: e.source, to: e.target })));
console.log('  ✓ Cycles detected:', cycleReport.cycles?.length || 0);

const smellReport = detectSmells(sampleNodes, sampleEdges);
console.log('  ✓ Code smells:', smellReport.smells?.length || 0);

const metrics = computeGraphMetrics(sampleNodes, sampleEdges);
console.log('  ✓ Graph metrics: nodes=', metrics.nodeCount, 'edges=', metrics.edgeCount, 'complexity=', metrics.cyclomaticComplexity);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 7: RISK MANAGEMENT (codeflow-store)                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { assessNodeRisk } = await import('./packages/codeflow-store/dist/risk/index.js');
const { createApprovalRequest } = await import('./packages/codeflow-store/dist/approval/index.js');

const nodeRisks = [
  { nodeId: 'jwt', name: 'JWTService', path: '/services/jwt.ts' },
  { nodeId: 'user', name: 'UserRepository', path: '/repositories/user.ts' },
  { nodeId: 'auth', name: 'AuthModule', path: '/auth/module.ts' }
];

for (const node of nodeRisks) {
  const risk = await assessNodeRisk(runId, projectName, node.nodeId, node.name, node.path);
  console.log('  ✓', node.name + ':', risk.level, 'risk');
}

const approval = await createApprovalRequest({
  runId, projectName, nodeId: 'auth-module', riskLevel: 'high',
  description: 'Auth module handles credential validation'
});
console.log('  ✓ Approval created:', approval.id);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 8: OBSERVABILITY (codeflow-store)                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { recordMetric, getMetrics } = await import('./packages/codeflow-store/dist/observability/index.js');
const { createCheckpoint } = await import('./packages/codeflow-store/dist/checkpoint/index.js');

await recordMetric(runId, projectName, 'nodes_executed', 3);
await recordMetric(runId, projectName, 'tokens_used', 15000);
await recordMetric(runId, projectName, 'duration_ms', 2500);
await recordMetric(runId, projectName, 'cost_usd', 0.15);
console.log('  ✓ Metrics recorded');

const checkpoint = await createCheckpoint({
  runId, projectName, phase: 'code_generation',
  data: { nodesGenerated: 4, edgesGenerated: 3 }
});
console.log('  ✓ Checkpoint created:', checkpoint.id);

const metricsSummary = await getMetrics(runId, projectName);
console.log('  ✓ Metrics retrieved:', Object.keys(metricsSummary).length, 'metrics');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  SECTION 9: MCP TOOLS (codeflow-mcp)                          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

const { getTools } = await import('./packages/codeflow-mcp/dist/tools/index.js');

const tools = getTools();
console.log('  ✓ Available tools:', tools.length);
console.log('    Tools:', tools.map(t => t.name).join(', '));

await updateRunStatus(runId, 'completed');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                    EXECUTION SUMMARY                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('  ✓ codeflow-prd: PRD generated');
console.log('  ✓ codeflow-store: Session', session.id);
console.log('  ✓ codeflow-store:', recovered.length, 'checkpoints');
console.log('  ✓ codeflow-agent: Blueprint via MiniMax');
console.log('  ✓ codeflow-agent: Code via MiniMax');
console.log('  ✓ codeflow-analysis: Graph analyzed');
console.log('  ✓ codeflow-store: Risk assessed');
console.log('  ✓ codeflow-store: Approval', approval.id);
console.log('  ✓ codeflow-store: Metrics recorded');
console.log('  ✓ codeflow-mcp:', tools.length, 'tools');
console.log('\n=== FULL CODEFLOW PIPELINE COMPLETED ===\n');
