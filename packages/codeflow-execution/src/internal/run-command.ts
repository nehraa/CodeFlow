/**
 * Run a command with timeout and capture output.
 * Copied from monorepo src/lib/server/run-command.ts
 * to keep codeflow-execution standalone.
 */
import { spawn } from "node:child_process";

export type RunCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
};

export type RunCommandOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  stdoutMaxBytes?: number;
  stderrMaxBytes?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  const { cwd = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS, env = {}, stdoutMaxBytes, stderrMaxBytes } = options;

  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const clean = (str: string, max: number | undefined): string => {
      if (max !== undefined && str.length > max) {
        return str.slice(0, max) + "\n... (truncated)";
      }
      return str;
    };

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeoutHandle: NodeJS.Timeout | null =
      timeoutMs < Infinity ? setTimeout(() => proc.kill("SIGKILL"), timeoutMs) : null;

    proc.on("close", (code, signal) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({
        stdout: clean(stdout, stdoutMaxBytes),
        stderr: clean(stderr, stderrMaxBytes),
        exitCode: code,
        signal: signal ?? null
      });
    });

    proc.on("error", (err: Error) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve({
        stdout,
        stderr: stderr + (err.message ? `\nError: ${err.message}` : ""),
        exitCode: null,
        signal: null
      });
    });
  });
}