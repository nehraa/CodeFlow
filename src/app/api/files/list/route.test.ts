import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/files/list/route";

const createdDirs: string[] = [];
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-files-list-test-"));
  createdDirs.push(tmpDir);
});

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
});

describe("POST /api/files/list", () => {
  it("lists files and directories within the workspace root", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "src" })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ path: string; name: string; isDirectory: boolean }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    // Directories should be sorted before files
    const firstDir = body.findIndex((entry) => entry.isDirectory);
    const firstFile = body.findIndex((entry) => !entry.isDirectory);
    if (firstDir !== -1 && firstFile !== -1) {
      expect(firstDir).toBeLessThan(firstFile);
    }

    // Must return relative paths (not absolute)
    for (const entry of body) {
      expect(path.isAbsolute(entry.path)).toBe(false);
    }
  });

  it("only returns allowed file extensions and directories", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "src" })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as Array<{ path: string; name: string; isDirectory: boolean }>;
    const files = body.filter((e) => !e.isDirectory);

    const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      expect(allowedExtensions.has(ext)).toBe(true);
    }
  });

  it("returns 404 for a non-existent directory", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "this-directory-does-not-exist-xyz" })
      })
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 when path points to a file, not a directory", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "package.json" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not a directory/i);
  });

  it("rejects path traversal outside workspace root", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "../../etc" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not allowed/i);
  });

  it("rejects absolute paths outside the workspace root", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "/etc" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not allowed/i);
  });

  it("returns 400 for missing path field", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });
});
