import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCheckpointIfNeeded } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = path.join(__dirname, "../../.test-store");

const cleanStore = () => {
  try {
    fsSync.rmSync(STORE_ROOT, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — best effort
  }
};

const withEnv = async <T>(fn: () => Promise<T>): Promise<T> => {
  const original = process.env.CODEFLOW_STORE_ROOT;
  process.env.CODEFLOW_STORE_ROOT = STORE_ROOT;
  try {
    return await fn();
  } finally {
    process.env.CODEFLOW_STORE_ROOT = original ?? "";
    cleanStore();
  }
};

describe("checkpoint", () => {
  beforeEach(() => {
    cleanStore();
  });

  describe("createCheckpointIfNeeded", () => {
    it("returns undefined when the target directory does not exist", async () => {
      await withEnv(async () => {
        const result = await createCheckpointIfNeeded(
          "/this/path/does/not/exist",
          "checkpoint-1"
        );
        expect(result).toBeUndefined();
      });
    });

    it("returns undefined when the target directory is empty", async () => {
      await withEnv(async () => {
        const targetDir = path.join(STORE_ROOT, "empty-project");
        await fs.mkdir(targetDir, { recursive: true });

        const result = await createCheckpointIfNeeded(targetDir, "checkpoint-1");
        expect(result).toBeUndefined();
      });
    });

    it("copies the directory contents when the target has files", async () => {
      await withEnv(async () => {
        const targetDir = path.join(STORE_ROOT, "my-project");
        await fs.mkdir(path.join(targetDir, "src"), { recursive: true });
        await fs.writeFile(path.join(targetDir, "src/index.ts"), "console.log('hello')");
        await fs.writeFile(path.join(targetDir, "package.json"), '{"name":"test"}');

        const result = await createCheckpointIfNeeded(targetDir, "checkpoint-1");
        expect(result).toBeDefined();
        expect(result).toContain("checkpoint-1");

        // Verify files were copied
        const copiedIndex = await fs.readFile(
          path.join(result!, "src", "index.ts"),
          "utf8"
        );
        expect(copiedIndex).toBe("console.log('hello')");

        const copiedPkg = await fs.readFile(
          path.join(result!, "package.json"),
          "utf8"
        );
        expect(copiedPkg).toBe('{"name":"test"}');
      });
    });

    it("preserves directory structure in the copy", async () => {
      await withEnv(async () => {
        const targetDir = path.join(STORE_ROOT, "nested-project");
        await fs.mkdir(path.join(targetDir, "src/lib/utils"), { recursive: true });
        await fs.writeFile(
          path.join(targetDir, "src/lib/utils/helper.ts"),
          "export const helper = true"
        );

        const result = await createCheckpointIfNeeded(targetDir, "checkpoint-nested");

        const copiedHelper = await fs.readFile(
          path.join(result!, "src", "lib", "utils", "helper.ts"),
          "utf8"
        );
        expect(copiedHelper).toBe("export const helper = true");
      });
    });

    it("overwrites existing checkpoint if called again", async () => {
      await withEnv(async () => {
        const targetDir = path.join(STORE_ROOT, "overwrite-test");
        await fs.mkdir(targetDir, { recursive: true });
        await fs.writeFile(path.join(targetDir, "file.txt"), "original");

        const result1 = await createCheckpointIfNeeded(targetDir, "checkpoint-overwrite");
        await fs.writeFile(path.join(targetDir, "file.txt"), "modified");

        const result2 = await createCheckpointIfNeeded(targetDir, "checkpoint-overwrite");

        // Second call should overwrite with fresh copy
        const content = await fs.readFile(
          path.join(result2!, "file.txt"),
          "utf8"
        );
        expect(content).toBe("modified");
      });
    });
  });
});
