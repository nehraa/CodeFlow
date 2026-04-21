import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const TERMINAL_REPO_PATH_HEADER = "x-codeflow-repo-path";

export type TerminalSessionStatus = "running" | "exited" | "error";

export type TerminalSessionSummary = {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  status: TerminalSessionStatus;
  startedAt: string;
  lastActivityAt: string;
  exitCode: number | null;
};

export type TerminalSessionSnapshot = TerminalSessionSummary & {
  output: string;
  truncated: boolean;
};

type InternalTerminalSession = TerminalSessionSnapshot & {
  child: ChildProcessWithoutNullStreams;
};

const DEFAULT_WORKSPACE_ROOT =
  process.env.CODEFLOW_REPO_ROOT ?? /* turbopackIgnore: true */ process.cwd();
const OUTPUT_CAP_BYTES = 128 * 1024;
const OUTPUT_TRUNCATION_NOTICE = "[CodeFlow] Older terminal output truncated.\n";

const sessions = new Map<string, InternalTerminalSession>();
let sessionCounter = 0;

const stripTruncationNotice = (value: string): string =>
  value.startsWith(OUTPUT_TRUNCATION_NOTICE) ? value.slice(OUTPUT_TRUNCATION_NOTICE.length) : value;

const clampOutput = (value: string): { output: string; truncated: boolean } => {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= OUTPUT_CAP_BYTES) {
    return { output: value, truncated: false };
  }

  const noticeBytes = Buffer.byteLength(OUTPUT_TRUNCATION_NOTICE, "utf8");
  const remainingBytes = Math.max(0, OUTPUT_CAP_BYTES - noticeBytes);
  const tail = buffer.subarray(Math.max(0, buffer.byteLength - remainingBytes)).toString("utf8");
  return {
    output: `${OUTPUT_TRUNCATION_NOTICE}${tail}`,
    truncated: true
  };
};

const appendOutput = (session: InternalTerminalSession, chunk: string) => {
  if (!chunk) {
    return;
  }

  const next = `${stripTruncationNotice(session.output)}${chunk}`;
  const clamped = clampOutput(next);
  session.output = clamped.output;
  session.truncated = clamped.truncated;
  session.lastActivityAt = new Date().toISOString();
};

const toSummary = (session: InternalTerminalSession): TerminalSessionSummary => ({
  id: session.id,
  title: session.title,
  cwd: session.cwd,
  shell: session.shell,
  status: session.status,
  startedAt: session.startedAt,
  lastActivityAt: session.lastActivityAt,
  exitCode: session.exitCode
});

const toSnapshot = (session: InternalTerminalSession): TerminalSessionSnapshot => ({
  ...toSummary(session),
  output: session.output,
  truncated: session.truncated
});

const resolveInitialCwd = async (cwd?: string): Promise<string> => {
  const resolved = cwd?.trim() ? path.resolve(cwd.trim()) : path.resolve(DEFAULT_WORKSPACE_ROOT);
  const stats = await fs.stat(resolved).catch(() => null);

  if (!stats?.isDirectory()) {
    throw new Error(`Terminal working directory does not exist or is not a directory: ${resolved}`);
  }

  return resolved;
};

const getShellPath = (): string => {
  const configuredShell = process.env.CODEFLOW_TERMINAL_SHELL?.trim();
  if (configuredShell) {
    return configuredShell;
  }

  return process.env.SHELL?.trim() || "/bin/sh";
};

const recordInput = (session: InternalTerminalSession, input: string) => {
  const printable = input
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .join("\n");

  if (!printable) {
    return;
  }

  appendOutput(
    session,
    `${printable
      .split("\n")
      .map((line) => `$ ${line}`)
      .join("\n")}\n`
  );
};

export const listTerminalSessions = (): TerminalSessionSummary[] =>
  [...sessions.values()]
    .map(toSummary)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

export const getTerminalSession = (id: string): TerminalSessionSnapshot | null => {
  const session = sessions.get(id);
  return session ? toSnapshot(session) : null;
};

export const createTerminalSession = async (options?: {
  cwd?: string;
  title?: string;
}): Promise<TerminalSessionSnapshot> => {
  const cwd = await resolveInitialCwd(options?.cwd);
  const shell = getShellPath();
  const child = spawn(shell, [], {
    cwd,
    env: {
      ...process.env,
      TERM: process.env.TERM || "xterm-256color"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const startedAt = new Date().toISOString();
  sessionCounter += 1;

  const session: InternalTerminalSession = {
    id: randomUUID(),
    title: options?.title?.trim() || `Shell ${sessionCounter}`,
    cwd,
    shell,
    status: "running",
    startedAt,
    lastActivityAt: startedAt,
    exitCode: null,
    output: "",
    truncated: false,
    child
  };

  child.stdout.on("data", (chunk: Buffer) => {
    appendOutput(session, chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk: Buffer) => {
    appendOutput(session, chunk.toString("utf8"));
  });

  child.on("error", (error) => {
    session.status = "error";
    session.exitCode = null;
    appendOutput(session, `\n[CodeFlow] Terminal process error: ${error.message}\n`);
  });

  child.on("close", (code) => {
    session.status = session.status === "error" ? "error" : "exited";
    session.exitCode = code;
    appendOutput(session, `\n[CodeFlow] Terminal exited with code ${code ?? "unknown"}.\\n`);
  });

  sessions.set(session.id, session);
  return toSnapshot(session);
};

export const writeTerminalInput = async (
  id: string,
  input: string,
  options?: { echoInput?: boolean }
): Promise<TerminalSessionSnapshot> => {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`Terminal session ${id} was not found.`);
  }

  if (session.status !== "running") {
    throw new Error(`Terminal session ${id} is no longer running.`);
  }

  if (options?.echoInput ?? true) {
    recordInput(session, input);
  }

  await new Promise<void>((resolve, reject) => {
    session.child.stdin.write(input, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  session.lastActivityAt = new Date().toISOString();
  return toSnapshot(session);
};

export const closeTerminalSession = (id: string): boolean => {
  const session = sessions.get(id);
  if (!session) {
    return false;
  }

  if (session.status === "running") {
    session.child.kill("SIGTERM");
  }

  sessions.delete(id);
  return true;
};

export const shutdownAllTerminalSessions = () => {
  for (const session of sessions.values()) {
    if (session.status === "running") {
      session.child.kill("SIGTERM");
    }
  }

  sessions.clear();
};
