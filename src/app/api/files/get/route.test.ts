import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-get-test-"));
  vi.stubEnv("CODEFLOW_REPO_ROOT", tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("GET /api/files/get", () => {
  it("returns 400 when the path query parameter is missing", async () => {
    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(new Request("http://localhost/api/files/get"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("MISSING_PATH");
  });

  it("returns 403 for a path traversal attempt (..)", async () => {
    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=../etc/passwd"),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN_PATTERN");
  });

  it("returns 403 for a dotfile path (.env)", async () => {
    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=.env"),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN_PATTERN");
  });

  it("returns 403 for a disallowed extension", async () => {
    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=malware.exe"),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("DISALLOWED_EXTENSION");
  });

  it("returns 404 when the file does not exist", async () => {
    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=nonexistent.ts"),
    );
    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FILE_NOT_FOUND");
  });

  it("reads a small file and returns its content as JSON", async () => {
    const fileContent = 'export const greeting = "hello";';
    await fs.writeFile(path.join(tmpDir, "hello.ts"), fileContent, "utf-8");

    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=hello.ts"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { path: string; content: string; size: number };
    expect(body.content).toBe(fileContent);
    expect(body.path).toBe("hello.ts");
    expect(body.size).toBe(Buffer.byteLength(fileContent, "utf-8"));
  });

  it("streams a file larger than 500KB with octet-stream content type", async () => {
    // Create a 600KB file
    const bigContent = Buffer.alloc(600 * 1024, 0x61); // filled with 'a'
    await fs.writeFile(path.join(tmpDir, "large.ts"), bigContent);

    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=large.ts"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toContain("large.ts");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 400 when path is a directory", async () => {
    await fs.mkdir(path.join(tmpDir, "sub"), { recursive: true });
    // Create a directory named "src.ts" (unusual, but tests the guard).
    await fs.mkdir(path.join(tmpDir, "src.ts"));

    const { GET } = await import("@/app/api/files/get/route");
    const response = await GET(
      new Request("http://localhost/api/files/get?path=src.ts"),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("IS_DIRECTORY");
  });
});