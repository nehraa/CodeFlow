import fs from "node:fs/promises";
import path from "node:path";

import type { Logger } from "../types.js";
import { ensureDir } from "../utils/filesystem.js";

const HOOK_MARKER = "# Added by CodeRag";

/**
 * Escape a value for safe interpolation into a POSIX shell single-quoted string.
 * Wraps the value in single quotes and escapes any embedded single quotes.
 */
const shellQuote = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";

const resolveGitDir = async (repoPath: string): Promise<string | null> => {
  const dotGitPath = path.join(repoPath, ".git");
  const stats = await fs.stat(dotGitPath).catch(() => null);
  if (!stats) {
    return null;
  }

  if (stats.isDirectory()) {
    return dotGitPath;
  }

  const content = await fs.readFile(dotGitPath, "utf8");
  const match = content.match(/gitdir:\s*(.+)\s*/i);
  if (!match?.[1]) {
    return null;
  }

  return path.resolve(repoPath, match[1]);
};

/**
 * Checks whether the CodeRag post-commit hook is installed.
 */
export const isPostCommitHookInstalled = async (repoPath: string): Promise<boolean> => {
  const gitDir = await resolveGitDir(repoPath);
  if (!gitDir) {
    return false;
  }

  const hookPath = path.join(gitDir, "hooks", "post-commit");
  const existingHook = await fs.readFile(hookPath, "utf8").catch(() => "");
  return existingHook.includes(HOOK_MARKER);
};

export const installPostCommitHook = async (
  repoPath: string,
  configPath: string | null,
  logger?: Logger
): Promise<void> => {
  const gitDir = await resolveGitDir(repoPath);
  if (!gitDir) {
    logger?.warn("Skipped git hook installation because no Git directory was found.", {
      repoPath
    });
    return;
  }

  const hooksDir = path.join(gitDir, "hooks");
  const hookPath = path.join(hooksDir, "post-commit");
  const backupHookPath = path.join(hooksDir, "post-commit.coderag.previous");
  await ensureDir(hooksDir);

  const existingHook = await fs.readFile(hookPath, "utf8").catch(() => "");
  if (existingHook.includes(HOOK_MARKER)) {
    return;
  }

  if (existingHook.trim()) {
    await fs.writeFile(backupHookPath, existingHook, "utf8");
  }

  const configArgument = configPath ? ` --config ${shellQuote(configPath)}` : "";
  const script = `#!/bin/sh
${HOOK_MARKER}
set -e
if [ -f ${shellQuote(backupHookPath)} ]; then
  sh ${shellQuote(backupHookPath)}
fi
if command -v npx >/dev/null 2>&1; then
  npx --no-install coderag reindex${configArgument} >/dev/null 2>&1 || true
fi
`;

  await fs.writeFile(hookPath, script, { mode: 0o755 });
};
