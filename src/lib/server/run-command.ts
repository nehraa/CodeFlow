import { spawn } from "node:child_process";

export type RunCommandOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  stdoutMaxBytes?: number;
  stderrMaxBytes?: number;
};

export type RunCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputCapped: boolean;
  signal: NodeJS.Signals | null;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_STDOUT_MAX_BYTES = 64 * 1024;
const DEFAULT_STDERR_MAX_BYTES = 128 * 1024;

const appendChunk = (
  current: string,
  chunk: Buffer,
  maxBytes: number
): { next: string; capped: boolean } => {
  const next = current + chunk.toString("utf8");
  if (Buffer.byteLength(next, "utf8") <= maxBytes) {
    return { next, capped: false };
  }

  const truncated = Buffer.from(next, "utf8").subarray(0, maxBytes).toString("utf8");
  return { next: truncated, capped: true };
};

export const runCommand = (
  command: string,
  args: string[],
  options: RunCommandOptions
): Promise<RunCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputCapped = false;
    let settled = false;

    const settle = (result: RunCommandResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      const updated = appendChunk(stdout, chunk, options.stdoutMaxBytes ?? DEFAULT_STDOUT_MAX_BYTES);
      stdout = updated.next;
      if (updated.capped) {
        outputCapped = true;
        child.kill("SIGKILL");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const updated = appendChunk(stderr, chunk, options.stderrMaxBytes ?? DEFAULT_STDERR_MAX_BYTES);
      stderr = updated.next;
      if (updated.capped) {
        outputCapped = true;
        child.kill("SIGKILL");
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeoutId);

      let finalStderr = stderr;
      if (timedOut) {
        finalStderr = `${finalStderr}\nCommand timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms.`.trim();
      }
      if (outputCapped) {
        finalStderr = `${finalStderr}\nCommand output exceeded the configured cap.`.trim();
      }

      settle({
        exitCode: code,
        stdout,
        stderr: finalStderr,
        timedOut,
        outputCapped,
        signal
      });
    });
  });
