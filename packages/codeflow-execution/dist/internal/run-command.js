/**
 * Run a command with timeout and capture output.
 * Copied from monorepo src/lib/server/run-command.ts
 * to keep codeflow-execution standalone.
 */
import { spawn } from "node:child_process";
const DEFAULT_TIMEOUT_MS = 30_000;
export async function runCommand(command, args, options = {}) {
    const { cwd = process.cwd(), timeoutMs = DEFAULT_TIMEOUT_MS, env = {}, stdoutMaxBytes, stderrMaxBytes } = options;
    return new Promise((resolve) => {
        const proc = spawn(command, args, {
            cwd,
            env: { ...process.env, ...env },
            stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        const clean = (str, max) => {
            if (max !== undefined && str.length > max) {
                return str.slice(0, max) + "\n... (truncated)";
            }
            return str;
        };
        proc.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        const timeoutHandle = timeoutMs < Infinity ? setTimeout(() => proc.kill("SIGKILL"), timeoutMs) : null;
        proc.on("close", (code, signal) => {
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            resolve({
                stdout: clean(stdout, stdoutMaxBytes),
                stderr: clean(stderr, stderrMaxBytes),
                exitCode: code,
                signal: signal ?? null
            });
        });
        proc.on("error", (err) => {
            if (timeoutHandle)
                clearTimeout(timeoutHandle);
            resolve({
                stdout,
                stderr: stderr + (err.message ? `\nError: ${err.message}` : ""),
                exitCode: null,
                signal: null
            });
        });
    });
}
