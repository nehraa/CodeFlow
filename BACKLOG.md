# Backlog

## Remaining product work
- Safe conflict remediation: apply selected drift fixes back into the blueprint or generated files instead of only reporting them.
- Persistent store hardening: replace the file-backed store with SQLite if concurrent access or richer querying becomes necessary.
- Remote sandbox support: add true git worktrees or remote sandboxes beyond the current local `.codeflow-sandboxes/` flow.

## R&D / future scope
- Memory-level tracing: sandboxed Node support for stack and memory snapshots mapped to blueprint nodes.
- Multi-language ingestion: extend analysis beyond TypeScript once the TS pipeline is stable enough to generalize.
- Collaboration/sharing: invite links or import/export bundles for multi-user workflows.
