import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  loadObservabilityConfig,
  saveObservabilityConfig
} from "./config.js";

describe("observability config", () => {
  const tmpDir = path.join(os.tmpdir(), `codeflow-test-config-${Date.now()}`);

  beforeEach(async () => {
    process.env.CODEFLOW_STORE_ROOT = tmpDir;
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CODEFLOW_STORE_ROOT;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return default config when file does not exist", async () => {
    const config = await loadObservabilityConfig("nonexistent-project");
    expect(config.maxSpans).toBe(500);
    expect(config.maxLogs).toBe(2000);
  });

  it("should load saved config", async () => {
    await saveObservabilityConfig("test-project", { maxSpans: 1000, maxLogs: 5000 });
    const config = await loadObservabilityConfig("test-project");
    expect(config.maxSpans).toBe(1000);
    expect(config.maxLogs).toBe(5000);
  });

  it("should merge saved config with defaults for missing fields", async () => {
    const configPath = path.join(
      tmpDir,
      "observability-config",
      "test-project.json"
    );
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({ maxSpans: 300 }), "utf8");
    const config = await loadObservabilityConfig("test-project");
    expect(config.maxSpans).toBe(300);
    expect(config.maxLogs).toBe(2000);
  });
});