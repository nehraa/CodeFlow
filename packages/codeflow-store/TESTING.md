# Testing `codeflow-store` in Isolation

This guide tests every sub-module of `codeflow-store` from scratch, using only the package itself — no monorepo, no Next.js app, no other CodeFlow packages.

---

## Prerequisites

You need `node` and `npm` installed. No other dependencies.

---

## Setup

```bash
# 1. Navigate to the package
cd /Users/abhinavnehra/git/CodeFlow/packages/codeflow-store

# 2. Install dependencies (if not already installed)
npm install

# 3. Build (if dist/ is not present or stale)
npm run build

# 4. Set an isolated store root so tests don't pollute your real ~/.codeflow-store
export CODEFLOW_STORE_ROOT=/tmp/cf-store-test
rm -rf /tmp/cf-store-test
```

All commands below assume `CODEFLOW_STORE_ROOT=/tmp/cf-store-test` is set. Every command writes to `/tmp/cf-store-test/` and nowhere else.

---

## Part 0 — Generate a Blueprint (using `codeflow-core`)

Most tests below use the pre-built `test-fixtures/blueprint.json` files. But you can also generate a fresh blueprint from scratch using `codeflow-core`'s `buildBlueprintGraph`.

> **Note:** `codeflow-core` must be built first. From the monorepo root:
> ```bash
> npm run build --workspace=@abhinav2203/codeflow-core
> ```

`codeflow-core` exposes `buildBlueprintGraph` from `src/analyzer/build.ts`. It accepts either a **PRD text** (markdown describing what to build) or a **repo path** (reverse-mode: analyzes existing TypeScript code to produce a blueprint).

### 0.1 — Generate from PRD text

```bash
node -e "
import { buildBlueprintGraph } from '/Users/abhinavnehra/git/CodeFlow/codeflow-core/src/analyzer/build.js';

const graph = await buildBlueprintGraph({
  projectName: 'my-app',
  mode: 'essential',
  prdText: \`
# Screens
- Login screen
- Dashboard

# APIs
- GET /users
- POST /orders

# Modules
- auth.ts: handles authentication
  -> calls: validateToken
  -> reads-state: session

# Workflows
Login screen -> Dashboard
  \`
});

console.log(JSON.stringify(graph, null, 2));
" > /tmp/my-blueprint.json
```

Expected output — a full `BlueprintGraph` with `nodes[]`, `edges[]`, and `workflows[]`:
```json
{
  "projectName": "my-app",
  "mode": "essential",
  "phase": "spec",
  "generatedAt": "<ISO timestamp>",
  "nodes": [
    { "id": "n1", "kind": "ui-screen", "name": "Login screen", ... },
    { "id": "n2", "kind": "ui-screen", "name": "Dashboard", ... },
    { "id": "n3", "kind": "module", "name": "auth", "path": "auth.ts", ... }
  ],
  "edges": [
    { "from": "n1", "to": "n3", "kind": "calls", ... }
  ],
  "workflows": [
    { "name": "login -> dashboard", "steps": ["Login screen", "Dashboard"] }
  ],
  "warnings": []
}
```

### 0.2 — Generate from an existing TypeScript repo (reverse mode)

Point `repoPath` at any TypeScript project:

```bash
mkdir -p /tmp/test-repo/src
cat << 'EOF' > /tmp/test-repo/src/index.ts
export function authenticate(email: string, password: string) {
  return { token: 'fake-token', email };
}
EOF

node -e "
import { buildBlueprintGraph } from '/Users/abhinavnehra/git/CodeFlow/codeflow-core/src/analyzer/build.js';

const graph = await buildBlueprintGraph({
  projectName: 'reverse-test',
  mode: 'essential',
  repoPath: '/tmp/test-repo/src'
});

console.log(JSON.stringify(graph, null, 2));
"
```

This extracts functions, classes, imports, and call relationships from the AST to build a blueprint automatically.

### 0.3 — Validate a blueprint schema

Once you have a `blueprint.json`, validate it matches the expected schema:

```bash
node -e "
import { blueprintGraphSchema } from '/Users/abhinavnehra/git/CodeFlow/codeflow-core/src/schema/index.js';
import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('/tmp/my-blueprint.json', 'utf8'));
const result = blueprintGraphSchema.safeParse(raw);

if (result.success) {
  console.log('Blueprint is valid!');
} else {
  console.error('Blueprint is invalid:', result.error);
  process.exit(1);
}
"
```

### What the pipeline looks like

```
PRD text OR TypeScript repo
        │
        ▼
┌──────────────────────────────────┐
│  parsePrd()   ← extracts from markdown
│  OR                              │
│  analyzeTypeScriptRepo()  ← extracts from AST
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  mergeNodes()  ← deduplicates
│  createImplicitWorkflowEdges()  ← builds edges from "step1 -> step2" syntax
└──────────────┬───────────────────┘
               │
               ▼
         BlueprintGraph
         { nodes[], edges[], workflows[] }
```

The two modes can be combined — pass both `prdText` and `repoPath` to merge a PRD's planned structure with the reality of existing code.

---

## Part 1 — Unit Tests

Run the existing test suite:

```bash
npm test
```

Expected output:
```
 ✓ src/session.test.ts > codeflow-store > session > creates a valid session ID
 ✓ src/session.test.ts > codeflow-store > risk > assesses export risk for a minimal blueprint
 ✓ src/session.test.ts > codeflow-store > risk > flags yolo mode in risk assessment
```

All 3 tests should pass.

---

## Part 2 — Type Checking

```bash
npm run check
```

Expected: no output (TypeScript compiles cleanly with no errors).

---

## Part 3 — Risk Assessment

Risk is the only sub-module that requires **no file I/O** — it purely computes a score from a blueprint + run plan. This is the easiest thing to test end-to-end.

### 3.1 — Low risk (minimal blueprint, no existing output)

```bash
node dist/bin/cli.js risk assess test-fixtures/minimal-blueprint.json
```

Expected output:
```json
{
  "fingerprint": "<a 64-char sha256 hex string>",
  "outputDir": "<cwd>/artifacts/test-project",
  "riskReport": {
    "score": 0,
    "level": "low",
    "requiresApproval": false,
    "factors": []
  },
  "hasExistingOutput": false
}
```

### 3.2 — Medium risk (has existing output directory)

```bash
# Create the output directory to trigger the "overwrite-existing-output" factor
mkdir -p /tmp/cf-store-test/artifacts/test-project
echo "some existing file" > /tmp/cf-store-test/artifacts/test-project/existing.ts

# Re-run risk assessment — should now flag existing output
node dist/bin/cli.js risk assess test-fixtures/minimal-blueprint.json
```

Expected output — `score` should be `4`, `level` should be `"medium"`, and `factors` should contain:
```json
{
  "code": "overwrite-existing-output",
  "message": "Output directory .../artifacts/test-project already contains files.",
  "score": 4
}
```

### 3.3 — High risk (yolo mode)

Yolo mode skips approval gates. Create a blueprint with `mode: "yolo"`:

```bash
cat << 'EOF' > /tmp/yolo-blueprint.json
{
  "projectName": "yolo-project",
  "mode": "yolo",
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "nodes": [],
  "edges": [],
  "workflows": [],
  "warnings": []
}
EOF

node dist/bin/cli.js risk assess /tmp/yolo-blueprint.json
```

Expected: `score` includes at least `2` from the `yolo-mode` factor.

### 3.4 — Risk on a real blueprint from codeflow-core

Generate a real blueprint using Part 0, then assess its risk:

```bash
# Generate a blueprint (from Part 0)
node -e "
import { buildBlueprintGraph } from '/Users/abhinavnehra/git/CodeFlow/codeflow-core/src/analyzer/build.js';
const graph = await buildBlueprintGraph({
  projectName: 'real-app',
  mode: 'essential',
  prdText: \`
# Screens
- Login
- Dashboard

# Modules
- auth.ts: handles login with email and password
- db.ts: database connection module
- dashboard.ts: renders dashboard data

# APIs
- GET /api/users
- POST /api/auth/login

# Workflows
Login -> Dashboard
  \`
});
console.log(JSON.stringify(graph));
" > /tmp/real-blueprint.json

# Assess risk on the real blueprint
node dist/bin/cli.js risk assess /tmp/real-blueprint.json
```

Expected: risk factors should include `repo-backed-context` (nodes have source refs), `large-task-set` (if tasks ≥ 20), etc. A small blueprint should score low.

---

## Part 4 — Session Management

The session store persists a `PersistedSession` (blueprint graph + run plan) to disk.

### 4.1 — Initialize a new session

```bash
node dist/bin/cli.js session init "test-project"
```

Expected output:
```json
{
  "sessionId": "<a uuid>",
  "projectName": "test-project",
  "updatedAt": "<ISO timestamp>",
  "repoPath": null,
  "graph": {
    "projectName": "test-project",
    "mode": "essential",
    "nodes": [],
    "edges": [],
    "workflows": [],
    "warnings": []
  },
  "runPlan": {
    "tasks": [],
    "batches": []
  },
  "lastRiskReport": null,
  "lastExportResult": null,
  "lastExecutionReport": null,
  "approvalIds": []
}
```

Verify it was written to disk:
```bash
cat /tmp/cf-store-test/sessions/test-project/latest.json
# → should match the output above (same sessionId, etc.)
```

### 4.2 — Load the latest session

```bash
node dist/bin/cli.js session last "test-project"
```

Expected: returns the same session as step 4.1 (sessionId, graph, etc.).

### 4.3 — Session survives a process restart (load from disk)

```bash
# Run a new node process — no in-memory state carried over
node dist/bin/cli.js session last "test-project"
```

Expected: same session data, proving it was persisted to disk and re-loaded correctly.

### 4.4 — Session with a real repo path

```bash
mkdir -p /tmp/test-repo
node dist/bin/cli.js session init "repo-project"
# Note: the CLI's "session init" currently creates a blank session.
# To test with a repo path, manually edit the session JSON:
echo '{"sessionId":"test","projectName":"repo-project","repoPath":"/tmp/test-repo","graph":{...}}' > /tmp/cf-store-test/sessions/repo-project/latest.json
```

---

## Part 5 — Approval Workflow

The approval store manages export requests that require human sign-off.

### 5.1 — Create an approval record

You need to construct the full approval record manually since there's no CLI subcommand for creation (it's done by the export flow):

```bash
node -e "
const { createApprovalRecord } = await import('./dist/approval/index.js');

const record = await createApprovalRecord({
  projectName: 'test-project',
  fingerprint: 'abc123fingerprint',
  outputDir: '/tmp/test-output',
  runPlan: { generatedAt: new Date().toISOString(), tasks: [], batches: [], warnings: [] },
  riskReport: { score: 6, level: 'high', requiresApproval: true, factors: [] }
});

console.log(JSON.stringify(record, null, 2));
"
```

Expected output:
```json
{
  "id": "<a uuid>",
  "action": "export",
  "projectName": "test-project",
  "status": "pending",
  "fingerprint": "abc123fingerprint",
  "requestedAt": "<ISO timestamp>",
  "outputDir": "/tmp/test-output",
  "runPlan": {...},
  "riskReport": {...}
}
```

Verify it was written to disk:
```bash
cat /tmp/cf-store-test/approvals/<approval-id>.json
```

### 5.2 — Get an approval record

```bash
# Replace <approval-id> with the id from step 5.1
node dist/bin/cli.js approval get <approval-id>
```

Expected: returns the same approval record.

### 5.3 — Approve the record

```bash
node dist/bin/cli.js approval approve <approval-id>
```

Expected output — `status` changes from `"pending"` to `"approved"`, and `approvedAt` is set:
```json
{
  "id": "<approval-id>",
  "status": "approved",
  "approvedAt": "<ISO timestamp>",
  ...
}
```

Verify the file was updated on disk:
```bash
cat /tmp/cf-store-test/approvals/<approval-id>.json
# → status should be "approved"
```

### 5.4 — Approval for non-existent record

```bash
node dist/bin/cli.js approval get does-not-exist-id
```

Expected: exits with code 1 and error message `Approval does-not-exist-id was not found.`

---

## Part 6 — Checkpoints

Checkpoints copy an entire project directory to a timestamped location. They let you roll back to a known-good state.

### 6.1 — Create a checkpoint

```bash
# First, create a "project" directory with some files
mkdir -p /tmp/my-project/src
echo "console.log('hello')" > /tmp/my-project/src/index.ts
echo "const x = 1" > /tmp/my-project/src/utils.ts

# Create a checkpoint
CHECKPOINT_ID="checkpoint-$(date +%s)"
node dist/bin/cli.js checkpoint create "$CHECKPOINT_ID" /tmp/my-project
```

Expected output:
```json
{
  "checkpointDir": "/tmp/cf-store-test/checkpoints/<checkpoint-id>"
}
```

Verify the directory was copied:
```bash
ls /tmp/cf-store-test/checkpoints/<checkpoint-id>/src/
# → index.ts  utils.ts
cat /tmp/cf-store-test/checkpoints/<checkpoint-id>/src/index.ts
# → console.log('hello')
```

### 6.2 — Modify the project, then restore the checkpoint

```bash
# Modify the project
echo "console.log('modified')" > /tmp/my-project/src/index.ts

# Verify it's changed
cat /tmp/my-project/src/index.ts
# → console.log('modified')

# Restore the checkpoint (copy it back)
cp -r /tmp/cf-store-test/checkpoints/<checkpoint-id>/* /tmp/my-project/

# Verify the original is back
cat /tmp/my-project/src/index.ts
# → console.log('hello')
```

---

## Part 7 — Run Records

Run records store the result of every execution of a blueprint.

### 7.1 — Save a run record

```bash
node -e "
const { saveRunRecord, createRunId } = await import('./dist/run/index.js');

const runId = createRunId();
const record = {
  id: runId,
  projectName: 'test-project',
  sessionId: 'test-session-123',
  status: 'success',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  tasks: [
    { id: 'task-1', nodeId: 'n1', status: 'success', durationMs: 120 }
  ],
  batches: [
    { index: 0, taskIds: ['task-1'], status: 'completed' }
  ],
  artifacts: [],
  errors: []
};

await saveRunRecord(record);
console.log('Saved run:', runId);
"
```

Verify it was written:
```bash
cat /tmp/cf-store-test/runs/<run-id>.json
# → should contain the run record
```

### 7.2 — List all run records

```bash
node dist/bin/cli.js run list
```

Expected: returns a JSON array of filenames like `["<run-id-1>.json", "<run-id-2>.json"]`.

---

## Part 8 — Branch Management

Branches let you maintain multiple named variants of a blueprint simultaneously.

### 8.1 — Save a named branch

```bash
node -e "
const { saveBranch } = await import('./dist/branch/index.js');

const branch = {
  id: 'feature-auth',
  projectName: 'test-project',
  name: 'feature-auth',
  description: 'Authentication module variant',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  graph: {
    projectName: 'test-project',
    mode: 'essential',
    nodes: [
      { id: 'n1', kind: 'screen', summary: 'Login screen' }
    ],
    edges: [],
    workflows: [],
    warnings: []
  },
  metadata: {}
};

await saveBranch(branch);
console.log('Saved branch');
"
```

Verify it was written:
```bash
cat /tmp/cf-store-test/branches/test-project/feature-auth.json
```

### 8.2 — List all branches

```bash
node dist/bin/cli.js branch list test-project
```

Expected: returns an array with the `feature-auth` branch.

### 8.3 — Load a specific branch

```bash
node -e "
const { loadBranch } = await import('./dist/branch/index.js');
const branch = await loadBranch('test-project', 'feature-auth');
console.log(JSON.stringify(branch, null, 2));
"
```

Expected: returns the branch with `id: "feature-auth"`.

### 8.4 — Delete a branch

```bash
node -e "
const { deleteBranch } = await import('./dist/branch/index.js');
await deleteBranch('test-project', 'feature-auth');
console.log('Deleted');
"

# Verify it's gone
node dist/bin/cli.js branch list test-project
# → should return []
```

---

## Part 9 — Observability

Observability stores merged trace spans and logs from execution runs.

### 9.1 — Merge spans and logs into a snapshot

```bash
# Create sample spans
cat << 'EOF' > /tmp/spans.json
[
  {
    "name": "auth.validate",
    "spanId": "s1",
    "traceId": "t1",
    "startTime": "2026-01-01T10:00:00.000Z",
    "endTime": "2026-01-01T10:00:01.000Z",
    "status": "ok",
    "attributes": {}
  }
]
EOF

# Create sample logs
cat << 'EOF' > /tmp/logs.json
[
  { "level": "info", "message": "Server started", "timestamp": "2026-01-01T10:00:00.000Z" }
]
EOF

# Merge into observability snapshot
node dist/bin/cli.js observability merge test-project /tmp/spans.json /tmp/logs.json
```

Expected output:
```json
{
  "projectName": "test-project",
  "updatedAt": "<ISO timestamp>",
  "spans": [...],
  "logs": [...]
}
```

### 9.2 — Load the observability snapshot

```bash
node dist/bin/cli.js observability get test-project
```

Expected: returns the same snapshot from step 9.1.

### 9.3 — Merging appends, not replaces

```bash
# Add more spans
cat << 'EOF' > /tmp/spans2.json
[
  {
    "name": "auth.login",
    "spanId": "s2",
    "traceId": "t1",
    "startTime": "2026-01-01T10:00:02.000Z",
    "endTime": "2026-01-01T10:00:03.000Z",
    "status": "ok",
    "attributes": {}
  }
]
EOF

cat << 'EOF' > /tmp/logs2.json
[]
EOF

node dist/bin/cli.js observability merge test-project /tmp/spans2.json /tmp/logs2.json

# Reload and verify both spans are present
node dist/bin/cli.js observability get test-project
# → spans should contain BOTH s1 and s2
```

### 9.4 — Observability caps at 500 items

```bash
# Create 600 spans
node -e "
const { mergeObservabilitySnapshot } = await import('./dist/observability/index.js');
const spans = Array.from({ length: 600 }, (_, i) => ({
  name: 'span-' + i,
  spanId: 's' + i,
  traceId: 't1',
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  status: 'ok',
  attributes: {}
}));
await mergeObservabilitySnapshot({ projectName: 'test-project', spans, logs: [] });
console.log('done');
"

node dist/bin/cli.js observability get test-project
# → spans.length should be 500 (not 600)
```

---

## Part 10 — Store Root Environment Variable

Verify that `CODEFLOW_STORE_ROOT` is respected and that multiple projects are fully isolated:

```bash
# Use a fresh store root
export CODEFLOW_STORE_ROOT=/tmp/cf-store-isolated
rm -rf /tmp/cf-store-isolated

# Create a session for project A
node dist/bin/cli.js session init "project-a"
# → stored in /tmp/cf-store-isolated/sessions/project-a/latest.json

# Create a session for project B
node dist/bin/cli.js session init "project-b"
# → stored in /tmp/cf-store-isolated/sessions/project-b/latest.json

# Verify they are separate
ls /tmp/cf-store-isolated/sessions/
# → project-a  project-b

# Each session should only return its own project
node dist/bin/cli.js session last "project-a"
node dist/bin/cli.js session last "project-b"
# → each returns the correct project, no mixing
```

---

## Part 11 — Full End-to-End Scenario

Simulate a real-world workflow using all sub-modules:

```bash
export CODEFLOW_STORE_ROOT=/tmp/cf-e2e
rm -rf /tmp/cf-e2e

PROJECT="my-app"
mkdir -p /tmp/$PROJECT/src

# Step 1 — Initialize session
SESSION=$(node dist/bin/cli.js session init "$PROJECT")
echo "Session created"

# Step 2 — Do some work (create a checkpoint before)
CHECKPOINT_ID="pre-refactor-$(date +%s)"
cp -r /tmp/$PROJECT /tmp/$PROJECT-backup  # simulate the "project dir" for checkpoint
node dist/bin/cli.js checkpoint create "$CHECKPOINT_ID" /tmp/$PROJECT-backup

# Step 3 — Assess risk
node dist/bin/cli.js risk assess test-fixtures/sample-blueprint.json /tmp/$PROJECT/artifacts

# Step 4 — Verify no approvals needed for low risk
# (sample-blueprint has no existing output, so risk should be low)

# Step 5 — Save a run record
node -e "
const { saveRunRecord, createRunId } = await import('./dist/run/index.js');
await saveRunRecord({
  id: createRunId(),
  projectName: '$PROJECT',
  sessionId: 'sess-1',
  status: 'success',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  tasks: [{ id: 't1', nodeId: 'n1', status: 'success', durationMs: 50 }],
  batches: [{ index: 0, taskIds: ['t1'], status: 'completed' }],
  artifacts: [],
  errors: []
});
"

# Step 6 — Create a branch
node -e "
const { saveBranch } = await import('./dist/branch/index.js');
await saveBranch({
  id: 'v2',
  projectName: '$PROJECT',
  name: 'v2',
  description: 'Architecture variant 2',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  graph: { projectName: '$PROJECT', mode: 'essential', nodes: [], edges: [], workflows: [], warnings: [] },
  metadata: {}
});
"

# Step 7 — List branches
node dist/bin/cli.js branch list "$PROJECT"
# → should contain v2

# Step 8 — Verify all run records
node dist/bin/cli.js run list
# → should have at least one run record

echo "End-to-end scenario complete!"
```

---

## File System State After All Tests

After running all tests with `CODEFLOW_STORE_ROOT=/tmp/cf-store-test`, the directory should look like:

```
/tmp/cf-store-test/
├── sessions/
│   ├── test-project/latest.json
│   └── repo-project/latest.json
├── approvals/
│   └── <approval-id>.json
├── checkpoints/
│   └── <checkpoint-id>/
│       └── src/
│           ├── index.ts
│           └── utils.ts
├── runs/
│   └── <run-id>.json
├── observability/
│   └── test-project.json
└── branches/
    └── test-project/
        └── feature-auth.json
```

---

## Troubleshooting

### "No session found for project: test-project"

You forgot to set `CODEFLOW_STORE_ROOT`. Sessions are being written to `~/.codeflow-store/` instead of your test dir. Run:
```bash
export CODEFLOW_STORE_ROOT=/tmp/cf-store-test
```

### "dist/bin/cli.js: not found"

Run:
```bash
npm run build
```

### TypeScript errors on `npm run check`

Run build from the monorepo root — `codeflow-store` depends on `@abhinav2203/codeflow-core` which must be built first:
```bash
cd /Users/abhinavnehra/git/CodeFlow
npm run build --workspace=@abhinav2203/codeflow-core
npm run build --workspace=@abhinav2203/codeflow-store
```
