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

// Idle/purge tunables. Picked as conservative defaults; see PR #30 review.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min — sessions idle this long are signalled to exit
const EXPIRED_OUTPUT_GRACE_MS = 60 * 1000; // 60 s — after exit, retain snapshot for this long before deletion
const PURGE_INTERVAL_MS = 30 * 1000; // 30 s — background sweep cadence
const SIGKILL_TIMEOUT_MS = 5 * 1000; // 5 s — SIGKILL escalation if SIGTERM is ignored

const sessions = new Map<string, InternalTerminalSession>();
let sessionCounter = 0;
let purgeTimer: NodeJS.Timeout | null = null;

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

/**
 * Send `signal` to the session's child, and schedule SIGKILL after
 * `SIGKILL_TIMEOUT_MS` if the process has not closed by then.
 *
 * Returns the escalation timer so the caller can `clearTimeout` it if the
 * `close` event fires first. The timer is `unref`'d so it never keeps the
 * event loop alive on its own.
 */
const killWithEscalation = (
  session: InternalTerminalSession,
  signal: NodeJS.Signals
): NodeJS.Timeout | null => {
  // If the process is already dead, nothing to do.
  if (session.status !== "running") {
    return null;
  }

  try {
    session.child.kill(signal);
  } catch {
    // Process may have exited between our status check and the kill call;
    // the close handler will run on its own and clean up state.
    return null;
  }

  const escalation = setTimeout(() => {
    if (session.status === "running") {
      try {
        session.child.kill("SIGKILL");
      } catch {
        // Best-effort.
      }
    }
  }, SIGKILL_TIMEOUT_MS);
  escalation.unref();
  return escalation;
};

/**
 * Sweep the session map and reap sessions that have outlived their useful life.
 *
 * Two cases:
 *  1. Sessions whose status is `"exited"` and whose `lastActivityAt` is more
 *     than `EXPIRED_OUTPUT_GRACE_MS` ago: delete them from the map. This is
 *     the "grace period" — callers that hold the snapshot can still see it
 *     for 60 s after the process dies.
 *  2. Sessions whose status is `"running"` but whose `lastActivityAt` is more
 *     than `IDLE_TIMEOUT_MS` ago: signal them to exit (SIGTERM, with SIGKILL
 *     escalation) and refresh `lastActivityAt` to "now". The session stays
 *     in the map; when the `close` event fires it transitions to `"exited"`
 *     and the next purge cycle handles deletion.
 *
 * Reaping happens in a single pass to avoid mutating the map while iterating.
 */
export const purgeIdleSessions = (now: number = Date.now()): void => {
  const idleCutoff = now - IDLE_TIMEOUT_MS;
  const expiredCutoff = now - EXPIRED_OUTPUT_GRACE_MS;

  for (const [id, session] of sessions) {
    if (session.status !== "running") {
      // Exited or error sessions: only delete after the grace period has elapsed.
      const lastActivity = Date.parse(session.lastActivityAt);
      if (Number.isFinite(lastActivity) && lastActivity <= expiredCutoff) {
        sessions.delete(id);
      }
      continue;
    }

    // Running session: refresh activity before deciding it's idle.
    const lastActivity = Date.parse(session.lastActivityAt);
    if (!Number.isFinite(lastActivity) || lastActivity > idleCutoff) {
      continue;
    }

    // Idle long-running session: signal exit and refresh activity. The
    // close handler will move status to "exited" and the next purge cycle
    // will delete the entry after the grace period.
    const escalation = killWithEscalation(session, "SIGTERM");
    session.lastActivityAt = new Date().toISOString();

    if (escalation !== null) {
      // If the process dies before the escalation timer fires, clear it so
      // we don't try to SIGKILL a process that's already gone.
      session.child.once("close", () => {
        clearTimeout(escalation);
      });
    }
  }
};

const ensurePurgeScheduler = (): void => {
  if (purgeTimer !== null) {
    return;
  }
  purgeTimer = setInterval(() => {
    purgeIdleSessions();
  }, PURGE_INTERVAL_MS);
  // Don't keep the event loop alive just for the purge sweep.
  purgeTimer.unref();
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
    appendOutput(session, `\n[CodeFlow] Terminal exited with code ${code ?? "unknown"}.\n`);
  });

  sessions.set(session.id, session);

  // First session creation kicks off the background purge sweep. Subsequent
  // creations are no-ops; the scheduler stays alive for the process lifetime.
  ensurePurgeScheduler();

  return toSnapshot(session);
};

export const writeTerminalInput = async (
  id: string,
  input: string,
  options?: { echoInput?: boolean }
): Promise<TerminalSessionSnapshot> => {
  // Defense-in-depth: a long-idle session must not be revived by a stray
  // client write. Purge before lookup so the session is gone if it expired.
  purgeIdleSessions();

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
    const escalation = killWithEscalation(session, "SIGTERM");
    // Wait for the process to actually die before dropping the session from
    // the map. If SIGKILL escalation fires first, the close handler will
    // still run on the eventual exit; we just don't want to leak the map
    // entry while the OS still holds the process.
    if (escalation !== null) {
      session.child.once("close", () => {
        sessions.delete(id);
      });
    } else {
      sessions.delete(id);
    }
    return true;
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

/**
 * Test-only helpers. Not part of the public API.
 */
export const __testing = {
  resetStateForTests: () => {
    if (purgeTimer !== null) {
      clearInterval(purgeTimer);
      purgeTimer = null;
    }
    sessions.clear();
  },
  isSchedulerRunning: () => purgeTimer !== null,
  sessionCount: () => sessions.size
};
