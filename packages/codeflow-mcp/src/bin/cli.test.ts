import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, "../../dist/bin/cli.js");

describe("CLI binary", () => {
  it("invoking without args prints usage to stdout", async () => {
    const child = spawn("node", [CLI_PATH], {
      env: { ...process.env, NODE_OPTIONS: "" },
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      let data = "";
      child.stdout?.on("data", (chunk) => { data += chunk.toString(); });
      child.stderr?.on("data", (chunk) => { data += chunk.toString(); });
      child.on("close", (code) => {
        resolve(data);
      });
      child.on("error", reject);
      setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 5_000);
    });

    expect(stdout).toContain("codeflow-mcp stdio");
    expect(stdout).toContain("Usage:");
  });

  it("stdio mode: initialize JSON-RPC yields correct response", async () => {
    const child = spawn("node", [CLI_PATH, "stdio"], {
      env: { ...process.env, NODE_OPTIONS: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutData = await new Promise<string>((resolve, reject) => {
      let data = "";
      child.stdout?.on("data", (chunk) => { data += chunk.toString(); });
      child.on("close", () => { resolve(data); });
      child.on("error", reject);

      const initMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } },
      }) + "\n";

      child.stdin?.write(initMessage);
      child.stdin?.end();

      setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 5_000);
    });

    const lines = stdoutData.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    const response = JSON.parse(lines[0]);
    expect(response.jsonrpc).toBe("2.0");
    expect(response.id).toBe(1);
    expect(response.result).toHaveProperty("protocolVersion", "2024-11-05");
    expect(response.result).toHaveProperty("capabilities");
    expect(response.result).toHaveProperty("serverInfo");
    expect(response.result.serverInfo.name).toBe("codeflow-mcp");
  });

  it("unknown subcommand prints usage without crashing", async () => {
    const child = spawn("node", [CLI_PATH, "unknown-cmd"], {
      env: { ...process.env, NODE_OPTIONS: "" },
    });

    const stdout = await new Promise<string>((resolve, reject) => {
      let data = "";
      child.stdout?.on("data", (chunk) => { data += chunk.toString(); });
      child.stderr?.on("data", (chunk) => { data += chunk.toString(); });
      child.on("close", () => { resolve(data); });
      child.on("error", reject);
      setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 5_000);
    });

    expect(stdout).toContain("Usage:");
  });
});