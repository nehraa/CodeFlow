import { afterEach, describe, expect, it, vi } from "vitest";

import { createConsoleLogger } from "../utils/logger.js";

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe("console logger", () => {
  it("writes structured info logs to stdout", () => {
    const spy = vi.fn();
    console.log = spy;
    const logger = createConsoleLogger();

    logger.info("indexed", { repoPath: "/repo" });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ level: "info", message: "indexed", repoPath: "/repo" }));
  });

  it("writes debug and warn logs to stdout", () => {
    const spy = vi.fn();
    console.log = spy;
    const logger = createConsoleLogger();

    logger.debug("debugging");
    logger.warn("warning");
    expect(spy).toHaveBeenNthCalledWith(1, JSON.stringify({ level: "debug", message: "debugging" }));
    expect(spy).toHaveBeenNthCalledWith(2, JSON.stringify({ level: "warn", message: "warning" }));
  });

  it("writes structured errors to stderr", () => {
    const spy = vi.fn();
    console.error = spy;
    const logger = createConsoleLogger();

    logger.error("failed", { code: "ERR" });
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ level: "error", message: "failed", code: "ERR" }));
  });
});
