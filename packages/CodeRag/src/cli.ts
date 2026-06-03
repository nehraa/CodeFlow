#!/usr/bin/env node
import type http from "node:http";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { installPostCommitHook } from "./indexer/git-hook.js";
import { createCodeRag, loadCodeRagConfig } from "./index.js";
import { serveStdioMcpServer } from "./mcp/server.js";
import { runSetupWizard } from "./cli/setup-wizard.js";
import { serveHttpServer } from "./service/http.js";

const JSON_FLAG = "--json";
const FLAGS_WITH_VALUES = new Set(["--config", "--depth"]);
const FLAGS_BOOLEAN = new Set(["--json", "--full", "--multi-hop"]);

const printUsage = () => {
  console.log(`Usage:
  coderag setup
  coderag init [--config path] [--json]
  coderag index [--config path] [--json]
  coderag reindex [--config path] [--full] [--json]
  coderag query "question" [--config path] [--depth 2] [--multi-hop] [--json]
  coderag serve-mcp [--config path]
  coderag serve-http [--config path]
  coderag doctor [--config path] [--json]`);
};

const readFlagValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const parseDepthFlag = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("--depth must be a positive integer.");
  }

  return Number(value);
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const readPositionals = (args: string[]): string[] => {
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) {
      continue;
    }

    if (argument.startsWith("--")) {
      if (FLAGS_WITH_VALUES.has(argument)) {
        index += 1;
      }

      // Boolean flags don't consume a value, just skip
      continue;
    }

    positionals.push(argument);
  }

  return positionals;
};

const printJson = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

const printIndexSummary = (label: string, indexedNodeCount: number, storageRoot: string): void => {
  console.log(`${label}: indexed ${indexedNodeCount} nodes into ${storageRoot}`);
};

const printDoctorStatus = (status: Record<string, unknown>): void => {
  console.log(`indexed: ${status.indexed ? "yes" : "no"}`);
  console.log(`indexedNodeCount: ${status.indexedNodeCount}`);
  console.log(`generatedAt: ${status.generatedAt ?? "never"}`);
  console.log(`repoPath: ${status.repoPath}`);
  console.log(`storageRoot: ${status.storageRoot}`);
  console.log(`provider: ${status.provider ?? "unknown"}`);
  console.log(`llmEnabled: ${status.llmEnabled ? "yes" : "no"}`);
};

const waitForTermination = async (server: http.Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const shutdown = () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
};

export const runCli = async (argv = process.argv): Promise<void> => {
  const [, , command, ...args] = argv;
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const configPath = readFlagValue(args, "--config");
  const config = command === "setup"
    ? null
    : await loadCodeRagConfig(process.cwd(), configPath);
  const coderag = config ? createCodeRag(config) : null;

  try {
    if (command === "setup") {
      await runSetupWizard(process.cwd());
      return;
    }

    // All commands below require a loaded config and coderag instance
    if (!config || !coderag) {
      throw new Error("Configuration is required for this command.");
    }

    if (command === "init") {
      const summary = await coderag.index();
      await installPostCommitHook(config.repoPath, configPath ?? null, config.logger);
      if (hasFlag(args, JSON_FLAG)) {
        printJson({ ok: true, indexedNodeCount: summary.indexedNodeCount, storageRoot: config.storageRoot });
      } else {
        printIndexSummary("initialized", summary.indexedNodeCount, config.storageRoot);
      }
      return;
    }

    if (command === "index") {
      const summary = await coderag.index();
      if (hasFlag(args, JSON_FLAG)) {
        printJson(summary);
      } else {
        printIndexSummary("indexed", summary.indexedNodeCount, config.storageRoot);
      }
      return;
    }

    if (command === "reindex") {
      const summary = await coderag.reindex({ full: hasFlag(args, "--full") });
      if (hasFlag(args, JSON_FLAG)) {
        printJson(summary);
      } else {
        printIndexSummary(hasFlag(args, "--full") ? "full reindex completed" : "reindex completed", summary.indexedNodeCount, config.storageRoot);
      }
      return;
    }

    if (command === "query") {
      const question = readPositionals(args)[0];
      if (!question) {
        throw new Error("query requires a question argument.");
      }

      const depth = parseDepthFlag(readFlagValue(args, "--depth"));
      const multiHop = hasFlag(args, "--multi-hop");
      const result = await coderag.query(question, {
        depth,
        multiHop,
        onToken: hasFlag(args, JSON_FLAG)
          ? undefined
          : (token) => {
              process.stdout.write(token);
            }
      });

      if (hasFlag(args, JSON_FLAG)) {
        printJson(result);
      } else if (result.answerMode === "context-only") {
        console.log(result.answer);
      } else {
        process.stdout.write("\n");
      }

      return;
    }

    if (command === "serve-mcp") {
      await serveStdioMcpServer(coderag, { logger: config.logger });
      return;
    }

    if (command === "serve-http") {
      const server = await serveHttpServer(coderag, config);
      await waitForTermination(server);
      return;
    }

    if (command === "doctor") {
      const status = await coderag.status();
      if (hasFlag(args, JSON_FLAG)) {
        printJson(status);
      } else {
        printDoctorStatus(status);
      }
      return;
    }

    printUsage();
    process.exitCode = 1;
  } finally {
    await coderag?.close();
  }
};

export const exitWithCliError = (error: unknown): never => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
};

const runAsMain = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

export const maybeRunCli = (): Promise<void> | undefined => {
  if (!runAsMain) {
    return undefined;
  }

  return runCli().catch(exitWithCliError);
};

void maybeRunCli();
