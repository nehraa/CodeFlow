# @abhinav2203/codeflow-core

Framework-agnostic CodeFlow analysis core.

## Install

```bash
npm install @abhinav2203/codeflow-core
```

## Exports

```ts
import { buildBlueprintGraph, analyzeTypeScriptRepo } from "@abhinav2203/codeflow-core/analyzer";
import { exportBlueprintArtifacts } from "@abhinav2203/codeflow-core/export";
import { detectGraphConflicts } from "@abhinav2203/codeflow-core/conflicts";
import type { BlueprintGraph } from "@abhinav2203/codeflow-core/schema";
```

## Scope

This package contains the reusable, Node-oriented blueprint logic extracted from CodeFlow:

- repository analysis
- blueprint graph building
- schema types and validation
- artifact export helpers
- blueprint conflict detection
- store path helpers

It does not include Next.js routes, UI components, browser stores, or provider-specific integrations.
