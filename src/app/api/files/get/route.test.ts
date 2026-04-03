import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/files/get/route";

const createdDirs: string[] = [];
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-files-get-test-"));
  createdDirs.push(tmpDir);
});

afterEach(async () => {
  await Promise.all(createdDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  createdDirs.length = 0;
});

describe("POST /api/files/get", () => {
  it("returns file content for a valid file within the workspace", async () => {
    const testFile = path.join(process.cwd(), "package.json");

    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "package.json" })
      })
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as { content: string; path: string };
    expect(body.content).toBeTruthy();
    expect(body.path).toBe("package.json");
    // Must not return absolute paths to the client
    expect(path.isAbsolute(body.path)).toBe(false);

    const actualContent = await fs.readFile(testFile, "utf-8");
    expect(body.content).toBe(actualContent);
  });

  it("returns 404 for a non-existent file", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "non-existent-file-that-does-not-exist.ts" })
      })
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 400 for a path pointing to a directory", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "src" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/directory/i);
  });

  it("rejects path traversal outside workspace root", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "../../etc/passwd" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not allowed/i);
  });

  it("rejects absolute paths outside the workspace root", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "/etc/passwd" })
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/not allowed/i);
  });

  it("returns 400 for missing path field", async () => {
    const response = await POST(
      new Request("http://localhost/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });
});
