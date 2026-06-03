import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { IndexingError } from "../errors/index.js";
import { IndexLock } from "../store/index-lock.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

const createLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

describe("IndexLock", () => {
  it("acquires and releases the lock around an action", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 1000 });
    const lockFilePath = path.join(storageRoot, "index.lock.json");

    await lock.withLock("index", async () => {
      expect(await fs.readFile(lockFilePath, "utf8")).toContain("\"reason\": \"index\"");
    });

    await expect(fs.stat(lockFilePath)).rejects.toThrow();
    await cleanupPaths([storageRoot]);
  });

  it("waits for an existing lock to be released", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, JSON.stringify({ pid: 1, host: "test", reason: "index" }), "utf8");
    setTimeout(() => {
      fs.rm(lockFilePath, { force: true }).catch(() => undefined);
    }, 25);

    const lock = new IndexLock(storageRoot, { timeoutMs: 500, pollMs: 10, staleMs: 1000 });
    await expect(lock.waitForRelease()).resolves.toBe(true);
    await cleanupPaths([storageRoot]);
  });

  it("returns false immediately when no lock file exists", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 1000 });

    await expect(lock.waitForRelease()).resolves.toBe(false);
    await cleanupPaths([storageRoot]);
  });

  it("tolerates a lock file disappearing during stale-lock inspection", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, JSON.stringify({ pid: 1, host: "test", reason: "index" }), "utf8");
    const statSpy = vi.spyOn(fs, "stat").mockRejectedValueOnce(new Error("gone"));
    setTimeout(() => {
      fs.rm(lockFilePath, { force: true }).catch(() => undefined);
    }, 0);

    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 1000 });
    await expect(lock.waitForRelease()).resolves.toBe(true);
    expect(statSpy).toHaveBeenCalled();

    await cleanupPaths([storageRoot]);
  });

  it("removes stale locks and logs the cleanup", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const logger = createLogger();
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, JSON.stringify({ pid: 1, host: "host", reason: "index" }), "utf8");
    const staleTime = Date.now() - 5_000;
    await fs.utimes(lockFilePath, staleTime / 1000, staleTime / 1000);

    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 50 }, logger);
    await expect(lock.waitForRelease()).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalled();

    await cleanupPaths([storageRoot]);
  });

  it("removes stale locks even when lock metadata is unreadable", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const logger = createLogger();
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, "{invalid", "utf8");
    const staleTime = Date.now() - 5_000;
    await fs.utimes(lockFilePath, staleTime / 1000, staleTime / 1000);

    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 50 }, logger);
    await expect(lock.waitForRelease()).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      "Removing stale CodeRag index lock.",
      expect.objectContaining({ pid: undefined })
    );

    await cleanupPaths([storageRoot]);
  });

  it("times out when the lock cannot be released", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, JSON.stringify({ pid: 1, host: "test", reason: "index" }), "utf8");

    const lock = new IndexLock(storageRoot, { timeoutMs: 20, pollMs: 10, staleMs: 10_000 });
    await expect(lock.waitForRelease()).rejects.toThrow(IndexingError);

    await cleanupPaths([storageRoot]);
  });

  it("times out when the lock cannot be acquired", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lockFilePath = path.join(storageRoot, "index.lock.json");
    await fs.mkdir(storageRoot, { recursive: true });
    await fs.writeFile(lockFilePath, JSON.stringify({ pid: 1, host: "test", reason: "index" }), "utf8");

    const lock = new IndexLock(storageRoot, { timeoutMs: 20, pollMs: 10, staleMs: 10_000 });
    await expect(lock.withLock("index", async () => "ok")).rejects.toThrow(IndexingError);

    await cleanupPaths([storageRoot]);
  });

  it("wraps non-EEXIST acquisition errors", async () => {
    const rootPath = await createTempDir("coderag-lock-");
    const storageRoot = path.join(rootPath, "storage-root-file");
    await fs.writeFile(storageRoot, "not-a-directory", "utf8");

    const lock = new IndexLock(storageRoot, { timeoutMs: 20, pollMs: 10, staleMs: 10_000 });
    await expect(lock.withLock("index", async () => "ok")).rejects.toThrow(IndexingError);

    await cleanupPaths([rootPath]);
  });

  it("wraps fs.open errors that are not lock-contention errors", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lock = new IndexLock(storageRoot, { timeoutMs: 20, pollMs: 10, staleMs: 10_000 });
    const openSpy = vi.spyOn(fs, "open").mockRejectedValueOnce(
      Object.assign(new Error("permission denied"), { code: "EACCES" })
    );

    await expect(lock.withLock("index", async () => "ok")).rejects.toThrow(IndexingError);
    expect(openSpy).toHaveBeenCalled();

    await cleanupPaths([storageRoot]);
  });

  it("releases the lock file even when the action fails", async () => {
    const storageRoot = await createTempDir("coderag-lock-");
    const lock = new IndexLock(storageRoot, { timeoutMs: 200, pollMs: 10, staleMs: 1000 });
    const lockFilePath = path.join(storageRoot, "index.lock.json");

    await expect(
      lock.withLock("index", async () => {
        expect(await fs.readFile(lockFilePath, "utf8")).toContain("\"reason\": \"index\"");
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    await expect(fs.stat(lockFilePath)).rejects.toThrow();

    await cleanupPaths([storageRoot]);
  });
});
