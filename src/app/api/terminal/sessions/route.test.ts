import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/terminal/sessions/route";
import { shutdownAllTerminalSessions } from "@/lib/server/terminal-sessions";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codeflow-terminal-sessions-"));
  process.env.CODEFLOW_TERMINAL_SHELL = "/bin/sh";
});

afterEach(async () => {
  shutdownAllTerminalSessions();
  delete process.env.CODEFLOW_TERMINAL_SHELL;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("GET /api/terminal/sessions", () => {
  it("lists terminal sessions after one is created", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/terminal/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-codeflow-repo-path": tmpDir
        },
        body: JSON.stringify({ title: "Workspace shell" })
      })
    );
    const createBody = (await createResponse.json()) as {
      session: { id: string; cwd: string; title: string; status: string };
    };

    expect(createResponse.status).toBe(201);
    expect(createBody.session.cwd).toBe(tmpDir);
    expect(createBody.session.title).toBe("Workspace shell");
    expect(createBody.session.status).toBe("running");

    const listResponse = await GET();
    const listBody = (await listResponse.json()) as {
      sessions: Array<{ id: string; cwd: string; title: string }>;
    };

    expect(listResponse.status).toBe(200);
    expect(listBody.sessions).toHaveLength(1);
    expect(listBody.sessions[0]).toMatchObject({
      id: createBody.session.id,
      cwd: tmpDir,
      title: "Workspace shell"
    });
  });
});
