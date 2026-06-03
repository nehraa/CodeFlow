import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type http from "node:http";

const originalExitCode = process.exitCode;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalArgv = [...process.argv];

beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = originalExitCode;
  process.stdout.write = originalStdoutWrite;
  process.argv = [...originalArgv];
  vi.restoreAllMocks();
});

const createMockCoderag = () => ({
  index: vi.fn().mockResolvedValue({ indexedNodeCount: 3 }),
  reindex: vi.fn().mockResolvedValue({ indexedNodeCount: 4 }),
  query: vi.fn().mockResolvedValue({
    answerMode: "context-only",
    answer: "answer",
    context: { primaryNode: null }
  }),
  status: vi.fn().mockResolvedValue({
    indexed: true,
    indexedNodeCount: 3,
    generatedAt: "2026-04-01T00:00:00.000Z",
    repoPath: "/repo",
    storageRoot: "/repo/.coderag",
    provider: "test",
    llmEnabled: false
  }),
  close: vi.fn().mockResolvedValue(undefined)
});

const loadCli = async (options?: {
  coderag?: ReturnType<typeof createMockCoderag>;
  server?: http.Server;
  argv?: string[];
}) => {
  vi.resetModules();
  const coderag = options?.coderag ?? createMockCoderag();
  if (options?.argv) {
    process.argv = [...options.argv];
  }
  const config = {
    repoPath: "/repo",
    storageRoot: "/repo/.coderag",
    service: { host: "127.0.0.1", port: 0 }
  };
  const installPostCommitHook = vi.fn().mockResolvedValue(undefined);
  const serveStdioMcpServer = vi.fn().mockResolvedValue(undefined);
  const server = options?.server ?? ({ close: (callback: (error?: Error | null) => void) => callback(null) } as unknown as http.Server);
  const serveHttpServer = vi.fn().mockResolvedValue(server);

  vi.doMock("../index.js", () => ({
    createCodeRag: vi.fn(() => coderag),
    loadCodeRagConfig: vi.fn().mockResolvedValue(config)
  }));
  vi.doMock("../indexer/git-hook.js", () => ({ installPostCommitHook }));
  vi.doMock("../mcp/server.js", () => ({ serveStdioMcpServer }));
  vi.doMock("../service/http.js", () => ({ serveHttpServer }));

  const cli = await import("../cli.js");
  return { cli, coderag, installPostCommitHook, serveStdioMcpServer, serveHttpServer };
};

describe("CLI", () => {
  it("prints usage when no command is provided", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { cli } = await loadCli();

    await cli.runCli(["node", "cli"]);

    expect(logSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("runs init and installs the git hook", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { cli, installPostCommitHook, coderag } = await loadCli();

    await cli.runCli(["node", "cli", "init"]);

    expect(coderag.index).toHaveBeenCalled();
    expect(installPostCommitHook).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("initialized: indexed 3 nodes into /repo/.coderag");
  });

  it("runs index, reindex, query, doctor, and serve-mcp", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const stdoutSpy = vi.fn(() => true);
    process.stdout.write = stdoutSpy as typeof process.stdout.write;
    const { cli, coderag, serveStdioMcpServer } = await loadCli();

    await cli.runCli(["node", "cli", "index"]);
    await cli.runCli(["node", "cli", "reindex", "--full"]);
    await cli.runCli(["node", "cli", "query", "auth"]);
    await cli.runCli(["node", "cli", "doctor"]);
    await cli.runCli(["node", "cli", "serve-mcp"]);

    expect(coderag.index).toHaveBeenCalledTimes(1);
    expect(coderag.reindex).toHaveBeenCalledWith({ full: true });
    expect(coderag.query).toHaveBeenCalledWith("auth", expect.objectContaining({ depth: undefined }));
    expect(logSpy).toHaveBeenCalledWith("indexed: yes");
    expect(serveStdioMcpServer).toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalledWith("\n");
  });

  it("prints json output for init, index, reindex, query, and doctor", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { cli, coderag } = await loadCli();
    coderag.query.mockResolvedValueOnce({ answerMode: "llm", answer: "llm", context: { primaryNode: null } });

    await cli.runCli(["node", "cli", "init", "--json"]);
    await cli.runCli(["node", "cli", "index", "--json"]);
    await cli.runCli(["node", "cli", "reindex", "--json"]);
    await cli.runCli(["node", "cli", "query", "auth", "--json"]);
    await cli.runCli(["node", "cli", "doctor", "--json"]);

    expect(logSpy).toHaveBeenCalledTimes(5);
  });

  it("streams llm responses and rejects missing query arguments", async () => {
    const stdoutSpy = vi.fn(() => true);
    process.stdout.write = stdoutSpy as typeof process.stdout.write;
    const coderag = createMockCoderag();
    coderag.query.mockImplementationOnce(async (_question, options) => {
      options?.onToken?.("streamed");
      return { answerMode: "llm", answer: "llm", context: { primaryNode: null } };
    });
    const { cli } = await loadCli({ coderag });

    await cli.runCli(["node", "cli", "query", "auth"]);
    expect(stdoutSpy).toHaveBeenCalledWith("streamed");
    expect(stdoutSpy).toHaveBeenCalledWith("\n");

    await expect(cli.runCli(["node", "cli", "query"])).rejects.toThrow("query requires a question argument.");
  });

  it("parses query flags while skipping empty arguments", async () => {
    const coderag = createMockCoderag();
    const { cli } = await loadCli({ coderag });

    await cli.runCli(["node", "cli", "query", "", "requireAuth", "--depth", "2", "--config", "custom.json"]);

    expect(coderag.query).toHaveBeenCalledWith(
      "requireAuth",
      expect.objectContaining({ depth: 2 })
    );
  });

  it("rejects invalid depth flags before querying", async () => {
    const coderag = createMockCoderag();
    const { cli } = await loadCli({ coderag });

    await expect(cli.runCli(["node", "cli", "query", "requireAuth", "--depth", "0"])).rejects.toThrow(
      "--depth must be a positive integer."
    );
    await expect(cli.runCli(["node", "cli", "query", "requireAuth", "--depth", "abc"])).rejects.toThrow(
      "--depth must be a positive integer."
    );
    expect(coderag.query).not.toHaveBeenCalled();
  });

  it("runs serve-http until a shutdown signal arrives", async () => {
    const { cli, serveHttpServer } = await loadCli();
    setTimeout(() => {
      process.emit("SIGINT");
    }, 0);

    await cli.runCli(["node", "cli", "serve-http"]);
    expect(serveHttpServer).toHaveBeenCalled();
  });

  it("surfaces shutdown errors from the http server", async () => {
    const failingServer = {
      close: (callback: (error?: Error | null) => void) => callback(new Error("close failed"))
    } as unknown as http.Server;
    const { cli } = await loadCli({ server: failingServer });
    setTimeout(() => {
      process.emit("SIGTERM");
    }, 0);

    await expect(cli.runCli(["node", "cli", "serve-http"])).rejects.toThrow("close failed");
  });

  it("prints usage for unknown commands", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { cli } = await loadCli();

    await cli.runCli(["node", "cli", "unknown"]);
    expect(logSpy).toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("prints the non-full reindex summary", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { cli } = await loadCli();

    await cli.runCli(["node", "cli", "reindex"]);

    expect(logSpy).toHaveBeenCalledWith("reindex completed: indexed 4 nodes into /repo/.coderag");
  });

  it("writes cli errors and exits with status 1", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const { exitWithCliError } = await import("../cli.js");

    expect(() => exitWithCliError(new Error("boom"))).toThrow("exit");
    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints doctor summaries when status fields are missing or false", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const coderag = createMockCoderag();
    coderag.status.mockResolvedValueOnce({
      indexed: false,
      indexedNodeCount: 0,
      generatedAt: null,
      repoPath: "/repo",
      storageRoot: "/repo/.coderag",
      provider: null,
      llmEnabled: true
    });
    const { cli } = await loadCli({ coderag });

    await cli.runCli(["node", "cli", "doctor"]);

    expect(logSpy).toHaveBeenCalledWith("indexed: no");
    expect(logSpy).toHaveBeenCalledWith("generatedAt: never");
    expect(logSpy).toHaveBeenCalledWith("provider: unknown");
    expect(logSpy).toHaveBeenCalledWith("llmEnabled: yes");
  });

  it("writes non-Error cli failures before exiting", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const { exitWithCliError } = await import("../cli.js");

    expect(() => exitWithCliError("boom")).toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("falls back to the error message when no stack trace is available", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const { exitWithCliError } = await import("../cli.js");
    const error = new Error("boom");
    error.stack = undefined;

    expect(() => exitWithCliError(error)).toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("runs the CLI bootstrap when the module is executed as the main entrypoint", async () => {
    const cliPath = fileURLToPath(new URL("../cli.ts", import.meta.url));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const coderag = createMockCoderag();

    await loadCli({
      coderag,
      argv: [process.execPath, cliPath, "doctor"]
    });

    expect(coderag.status).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("indexed: yes");
  });

  it("does not bootstrap when there is no entrypoint argv", async () => {
    const { cli } = await loadCli({ argv: [process.execPath] });

    expect(cli.maybeRunCli()).toBeUndefined();
  });
});
