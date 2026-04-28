#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { detectCycles, hasCycles } from "./cycles.js";
import { detectSmells } from "./smells.js";
import { computeGraphMetrics } from "./metrics.js";
import { detectDrift, healGraph } from "./refactor.js";
import { detectGraphConflicts } from "./conflicts.js";
import { blueprintGraphSchema } from "@abhinav2203/codeflow-core/schema";

// ── CLI ─────────────────────────────────────────────────────────────────────

export const runCLI = async () => {
  const [command, ...args] = process.argv.slice(2);

  const readBlueprint = (arg: string): string => {
    const filePath = resolve(arg);
    return readFileSync(filePath, "utf-8");
  };

  const parseBlueprint = (content: string) => blueprintGraphSchema.parse(JSON.parse(content));

  const printJson = (data: unknown) => {
    console.log(JSON.stringify(data, null, 2));
  };

  const exit = (code: number, message?: string) => {
    if (message) console.error(message);
    process.exit(code);
  };

  const MISSING_ARG = (cmd: string) =>
    `codeflow-analysis ${cmd}: missing required argument <blueprint-path>`;

  const UNREADABLE = (path: string) =>
    `codeflow-analysis: could not read file "${path}"`;

  const INVALID_BLUEPRINT = (path: string, error: unknown) =>
    `codeflow-analysis: invalid blueprint at "${path}": ${error instanceof Error ? error.message : error}`;

  try {
    switch (command) {
      // ── cycles ────────────────────────────────────────────────────────────────
      case "cycles": {
        const [blueprintPath] = args;
        if (!blueprintPath) exit(1, MISSING_ARG("cycles"));

        let graph;
        try {
          graph = parseBlueprint(readBlueprint(blueprintPath));
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
          exit(1, INVALID_BLUEPRINT(blueprintPath, e));
        }

        const report = detectCycles(graph as Parameters<typeof detectCycles>[0]);
        printJson({ report, hasCycles: hasCycles(graph as Parameters<typeof hasCycles>[0]) });
        break;
      }

      // ── smells ───────────────────────────────────────────────────────────────
      case "smells": {
        const [blueprintPath] = args;
        if (!blueprintPath) exit(1, MISSING_ARG("smells"));

        let graph;
        try {
          graph = parseBlueprint(readBlueprint(blueprintPath));
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
          exit(1, INVALID_BLUEPRINT(blueprintPath, e));
        }

        const report = detectSmells(graph as Parameters<typeof detectSmells>[0]);
        printJson({ report });
        break;
      }

      // ── metrics ─────────────────────────────────────────────────────────────
      case "metrics": {
        const [blueprintPath] = args;
        if (!blueprintPath) exit(1, MISSING_ARG("metrics"));

        let graph;
        try {
          graph = parseBlueprint(readBlueprint(blueprintPath));
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
          exit(1, INVALID_BLUEPRINT(blueprintPath, e));
        }

        const metrics = computeGraphMetrics(graph as Parameters<typeof computeGraphMetrics>[0]);
        printJson({ metrics });
        break;
      }

      // ── refactor detect ──────────────────────────────────────────────────────
      case "refactor": {
        const sub = args[0];
        const [blueprintPath] = args.slice(1);

        if (sub === "detect") {
          if (!blueprintPath) exit(1, MISSING_ARG("refactor detect"));

          let graph;
          try {
            graph = parseBlueprint(readBlueprint(blueprintPath));
          } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
            exit(1, INVALID_BLUEPRINT(blueprintPath, e));
          }

          const report = detectDrift(graph as Parameters<typeof detectDrift>[0]);
          printJson({ report });
          break;
        }

        if (sub === "heal") {
          if (!blueprintPath) exit(1, MISSING_ARG("refactor heal"));

          let graph;
          try {
            graph = parseBlueprint(readBlueprint(blueprintPath));
          } catch (e: unknown) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
            exit(1, INVALID_BLUEPRINT(blueprintPath, e));
          }

          const report = detectDrift(graph as Parameters<typeof detectDrift>[0]);
          const result = healGraph(graph as Parameters<typeof healGraph>[0], report);
          printJson({ report, result });
          break;
        }

        exit(1, `codeflow-analysis refactor: unknown subcommand "${sub}". Use "detect" or "heal".`);
        break;
      }

      // ── conflicts ────────────────────────────────────────────────────────────
      case "conflicts": {
        const [blueprintPath, repoPath] = args;
        if (!blueprintPath) exit(1, MISSING_ARG("conflicts"));

        let graph;
        try {
          graph = parseBlueprint(readBlueprint(blueprintPath));
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") exit(1, UNREADABLE(blueprintPath));
          exit(1, INVALID_BLUEPRINT(blueprintPath, e));
        }

        const resolvedRepoPath = repoPath ?? process.cwd();
        const report = await detectGraphConflicts(graph as Parameters<typeof detectGraphConflicts>[0], resolvedRepoPath);
        printJson({ report });
        break;
      }

      case undefined:
        exit(1, `codeflow-analysis: missing command. Usage:

  codeflow-analysis cycles <blueprint-path>
  codeflow-analysis smells <blueprint-path>
  codeflow-analysis metrics <blueprint-path>
  codeflow-analysis refactor detect <blueprint-path>
  codeflow-analysis refactor heal <blueprint-path>
  codeflow-analysis conflicts <blueprint-path> [repo-path]`);

      default:
        exit(1, `codeflow-analysis: unknown command "${command}". Use cycles, smells, metrics, refactor, or conflicts.`);
    }
  } catch (error) {
    exit(1, `codeflow-analysis: unexpected error: ${error instanceof Error ? error.message : error}`);
  }
};

// Run when executed directly
runCLI();
