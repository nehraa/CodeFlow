import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { IndexingError } from "../errors/index.js";
import type { LockingConfig, Logger } from "../types.js";
import { ensureDir, fileExists, readJson } from "../utils/filesystem.js";

const LOCK_FILE_NAME = "index.lock.json";

type LockMetadata = {
  pid: number;
  host: string;
  reason: string;
  acquiredAt: string;
};

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
};

const isAlreadyExistsError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const buildLockMetadata = (reason: string): LockMetadata => ({
  pid: process.pid,
  host: os.hostname(),
  reason,
  acquiredAt: new Date().toISOString()
});

/**
 * Coordinates access to the shared on-disk index state across processes.
 */
export class IndexLock {
  private readonly lockFilePath: string;

  constructor(
    storageRoot: string,
    private readonly config: LockingConfig,
    private readonly logger?: Logger
  ) {
    this.lockFilePath = path.join(storageRoot, LOCK_FILE_NAME);
  }

  async withLock<Value>(reason: string, action: () => Promise<Value>): Promise<Value> {
    const releaseLock = await this.acquire(reason);

    try {
      return await action();
    } finally {
      await releaseLock();
    }
  }

  async waitForRelease(): Promise<boolean> {
    const startTime = Date.now();
    let waited = false;

    while (await fileExists(this.lockFilePath)) {
      waited = true;
      await this.clearStaleLock();
      if (!(await fileExists(this.lockFilePath))) {
        break;
      }

      if (Date.now() - startTime > this.config.timeoutMs) {
        throw new IndexingError("Timed out while waiting for the repository index lock to be released.", {
          lockFilePath: this.lockFilePath
        });
      }

      await sleep(this.config.pollMs);
    }

    return waited;
  }

  private async acquire(reason: string): Promise<() => Promise<void>> {
    const startTime = Date.now();
    try {
      await ensureDir(path.dirname(this.lockFilePath));
    } catch (error) {
      throw new IndexingError("Failed to prepare the repository index lock directory.", {
        lockFilePath: this.lockFilePath
      }, { cause: error });
    }

    while (true) {
      try {
        const handle = await fs.open(this.lockFilePath, "wx");
        const metadata = buildLockMetadata(reason);
        await handle.writeFile(`${JSON.stringify(metadata, null, 2)}\n`, "utf8");
        await handle.close();

        return async () => {
          await fs.rm(this.lockFilePath, { force: true });
        };
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw new IndexingError("Failed to acquire the repository index lock.", {
            lockFilePath: this.lockFilePath
          }, { cause: error });
        }

        await this.clearStaleLock();
        if (Date.now() - startTime > this.config.timeoutMs) {
          throw new IndexingError("Timed out while waiting to acquire the repository index lock.", {
            lockFilePath: this.lockFilePath
          });
        }

        await sleep(this.config.pollMs);
      }
    }
  }

  private async clearStaleLock(): Promise<void> {
    const stats = await fs.stat(this.lockFilePath).catch(() => null);
    if (!stats) {
      return;
    }

    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs <= this.config.staleMs) {
      return;
    }

    const metadata = await readJson<LockMetadata>(this.lockFilePath).catch(() => null);
    this.logger?.warn("Removing stale CodeRag index lock.", {
      lockFilePath: this.lockFilePath,
      ageMs,
      pid: metadata?.pid,
      host: metadata?.host,
      reason: metadata?.reason
    });
    await fs.rm(this.lockFilePath, { force: true });
  }
}
