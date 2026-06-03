import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { installPostCommitHook, isPostCommitHookInstalled } from "../indexer/git-hook.js";
import { cleanupPaths, createTempDir } from "./helpers.js";

describe("git hook installation", () => {
  it("skips installation when the repo is not a git repository", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    await installPostCommitHook(repoPath, null, logger);
    expect(logger.warn).toHaveBeenCalled();

    await cleanupPaths([repoPath]);
  });

  it("installs a post-commit hook and preserves previous logic", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const hooksDir = path.join(repoPath, ".git", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });
    await fs.writeFile(path.join(hooksDir, "post-commit"), "#!/bin/sh\necho previous\n", "utf8");

    await installPostCommitHook(repoPath, "coderag.config.json");

    const hookContent = await fs.readFile(path.join(hooksDir, "post-commit"), "utf8");
    const backupContent = await fs.readFile(path.join(hooksDir, "post-commit.coderag.previous"), "utf8");

    expect(hookContent).toContain("npx --no-install coderag reindex --config 'coderag.config.json'");
    expect(backupContent).toContain("echo previous");

    await cleanupPaths([repoPath]);
  });

  it("supports gitdir indirection files and avoids duplicate installation", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const actualGitDir = path.join(repoPath, ".real-git");
    await fs.mkdir(path.join(actualGitDir, "hooks"), { recursive: true });
    await fs.writeFile(path.join(repoPath, ".git"), `gitdir: ${actualGitDir}\n`, "utf8");

    await installPostCommitHook(repoPath, null);
    const firstInstall = await fs.readFile(path.join(actualGitDir, "hooks", "post-commit"), "utf8");
    await installPostCommitHook(repoPath, null);
    const secondInstall = await fs.readFile(path.join(actualGitDir, "hooks", "post-commit"), "utf8");

    expect(secondInstall).toBe(firstInstall);

    await cleanupPaths([repoPath]);
  });

  it("skips malformed gitdir pointer files", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    await fs.writeFile(path.join(repoPath, ".git"), "not-a-gitdir-file\n", "utf8");

    await installPostCommitHook(repoPath, null, logger);
    expect(logger.warn).toHaveBeenCalled();

    await cleanupPaths([repoPath]);
  });

  it("returns false when no hook is installed", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    await fs.mkdir(path.join(repoPath, ".git", "hooks"), { recursive: true });

    const installed = await isPostCommitHookInstalled(repoPath);
    expect(installed).toBe(false);

    await cleanupPaths([repoPath]);
  });

  it("returns true after the hook is installed", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const hooksDir = path.join(repoPath, ".git", "hooks");
    await fs.mkdir(hooksDir, { recursive: true });

    await installPostCommitHook(repoPath, null);
    const installed = await isPostCommitHookInstalled(repoPath);
    expect(installed).toBe(true);

    await cleanupPaths([repoPath]);
  });

  it("returns false for non-git directories", async () => {
    const repoPath = await createTempDir("coderag-hook-");
    const installed = await isPostCommitHookInstalled(repoPath);
    expect(installed).toBe(false);

    await cleanupPaths([repoPath]);
  });
});
