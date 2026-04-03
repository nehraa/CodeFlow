import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-post-test-"));
  vi.stubEnv("CODEFLOW_REPO_ROOT", tmpDir);
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("POST /api/files/post", () => {
  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not valid json",
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("INVALID_JSON");
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 for a path traversal attempt (..)", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "../evil.ts", content: "bad" }),
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN_PATTERN");
  });

  it("returns 403 for a dotfile path (.env)", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: ".env", content: "SECRET=bad" }),
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN_PATTERN");
  });

  it("creates a new file and reports created: true", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "new-file.ts", content: "export default {};" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { created: boolean; path: string; size: number };
    expect(body.created).toBe(true);
    expect(body.path).toBe("new-file.ts");

    // Verify the file was actually written to the tmp directory
    const written = await fs.readFile(path.join(tmpDir, "new-file.ts"), "utf-8");
    expect(written).toBe("export default {};");
  });

  it("updates an existing file and reports created: false", async () => {
    await fs.writeFile(path.join(tmpDir, "existing.ts"), "old content", "utf-8");

    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "existing.ts", content: "new content" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { created: boolean };
    expect(body.created).toBe(false);

    const written = await fs.readFile(path.join(tmpDir, "existing.ts"), "utf-8");
    expect(written).toBe("new content");
  });

  it("creates parent directories when they do not exist", async () => {
    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: "src/components/Button.tsx", content: "export default () => null;" }),
      }),
    );
    expect(response.status).toBe(200);

    const written = await fs.readFile(
      path.join(tmpDir, "src/components/Button.tsx"),
      "utf-8",
    );
    expect(written).toBe("export default () => null;");
  });

  it("writes base64-encoded content as raw bytes without UTF-8 re-encoding", async () => {
    // Use bytes that are valid in base64 but would be corrupted by a UTF-8
    // round-trip (0xff is not a valid UTF-8 start byte, so converting the Buffer
    // to a UTF-8 string and writing that would replace these bytes with the
    // replacement character U+FFFD).  Buffer.compare(written, binaryData) === 0
    // confirms the exact bytes were preserved, proving no UTF-8 conversion happened.
    const binaryData = Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x89]);
    const base64Content = binaryData.toString("base64");

    const { POST } = await import("@/app/api/files/post/route");
    const response = await POST(
      new Request("http://localhost/api/files/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "binary.txt",
          content: base64Content,
          encoding: "base64",
        }),
      }),
    );
    expect(response.status).toBe(200);

    const written = await fs.readFile(path.join(tmpDir, "binary.txt"));
    expect(Buffer.compare(written, binaryData)).toBe(0);
  });
});
