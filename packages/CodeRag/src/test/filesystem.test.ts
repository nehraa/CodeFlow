import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ensureDir,
  fileExists,
  hashContent,
  hashFile,
  readJson,
  readTextFile,
  resolveWithin,
  writeJson
} from "../utils/filesystem.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

describe("filesystem utilities", () => {
  it("creates directories and writes atomic json files", async () => {
    const rootPath = await createTempDir("coderag-fs-");
    const filePath = path.join(rootPath, "nested", "value.json");

    await ensureDir(path.dirname(filePath));
    await writeJson(filePath, { ok: true });

    expect(await fileExists(filePath)).toBe(true);
    expect(await readJson<{ ok: boolean }>(filePath)).toEqual({ ok: true });
    await cleanupPaths([rootPath]);
  });

  it("hashes content and files consistently", async () => {
    const rootPath = await createTempDir("coderag-fs-");
    const filePath = path.join(rootPath, "value.txt");
    await fs.writeFile(filePath, "hello", "utf8");

    expect(await hashFile(filePath)).toBe(hashContent("hello"));
    expect(await readTextFile(filePath)).toBe("hello");
    expect(resolveWithin(rootPath, "value.txt")).toBe(path.join(rootPath, "value.txt"));
    expect(resolveWithin(rootPath, filePath)).toBe(filePath);

    await cleanupPaths([rootPath]);
  });
});
