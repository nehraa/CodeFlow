import { access, realpath } from "fs/promises";
import { constants } from "fs";
import { resolve, isAbsolute, normalize } from "path";

/**
 * Stream threshold in bytes (500KB).
 * Files larger than this should be streamed rather than loaded into memory.
 */
export const STREAM_THRESHOLD_BYTES: number = 512 * 1024;

/**
 * Whitelist of allowed file extensions for security.
 * Only these extensions can be accessed through the file API.
 */
export const ALLOWED_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".scss",
  ".html",
  ".yaml",
  ".yml",
];

/**
 * Error codes for file security validation failures.
 */
export type FileSecurityErrorCode =
  | "EMPTY_PATH"
  | "ABSOLUTE_PATH"
  | "FORBIDDEN_PATTERN"
  | "PATH_ESCAPE"
  | "DISALLOWED_EXTENSION";

/**
 * Custom error class for file security violations.
 * Provides structured error information with codes for programmatic handling.
 */
export class FileSecurityError extends Error {
  /**
   * Error code identifying the type of security violation.
   */
  public readonly code: FileSecurityErrorCode;

  /**
   * Creates a new FileSecurityError.
   *
   * @param message - Human-readable error description
   * @param code - Machine-readable error code for programmatic handling
   */
  constructor(message: string, code: FileSecurityErrorCode) {
    super(message);
    this.code = code;
    this.name = "FileSecurityError";

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileSecurityError);
    }
  }
}

/**
 * Gets the repository root directory.
 * Uses CODEFLOW_REPO_ROOT environment variable or falls back to process.cwd().
 *
 * @returns The resolved repository root path
 */
function getRepoRoot(repoRoot?: string): string {
  const root = repoRoot ?? process.env.CODEFLOW_REPO_ROOT ?? process.cwd();
  return resolve(root);
}

/**
 * Validates that a file extension is in the allowed whitelist.
 *
 * @param filePath - The file path to check
 * @returns True if the extension is allowed
 */
function hasAllowedExtension(filePath: string): boolean {
  const lastDotIndex = filePath.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return false;
  }

  const extension = filePath.slice(lastDotIndex).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(extension);
}

/**
 * Checks if a path contains directory traversal patterns or forbidden segments.
 *
 * @param filePath - The path to check
 * @returns Object indicating if path is safe and the reason if not
 */
function checkForbiddenPatterns(filePath: string): {
  isSafe: boolean;
  reason?: string;
} {
  const normalized = normalize(filePath);

  // Check for parent directory traversal (..)
  const segments = normalized.split(/[\/\\]/);
  for (const segment of segments) {
    if (segment === "..") {
      return { isSafe: false, reason: "Path contains parent directory traversal" };
    }
  }

  // Check for dotfiles (hidden files/directories)
  for (const segment of segments) {
    if (segment.startsWith(".") && segment !== "." && segment !== "..") {
      return { isSafe: false, reason: `Dotfile not allowed: ${segment}` };
    }
  }

  // Check for node_modules
  for (const segment of segments) {
    if (segment.toLowerCase() === "node_modules") {
      return { isSafe: false, reason: "Access to node_modules is forbidden" };
    }
  }

  return { isSafe: true };
}

/**
 * Validates a relative file path for security and returns the resolved absolute path.
 *
 * Security checks performed:
 * - Path must not be empty
 * - Path must be relative (no leading slash)
 * - Path must not contain parent directory traversal (..)
 * - Path must not reference dotfiles (.env, .gitignore, etc.)
 * - Path must not reference node_modules
 * - Extension must be in the allowed whitelist
 * - Resolved path must be within the repository root
 *
 * @param relativePath - The relative file path to validate
 * @param repoRoot - Optional repository root override (defaults to CODEFLOW_REPO_ROOT or process.cwd())
 * @returns The resolved absolute path
 * @throws FileSecurityError if any security check fails
 */
export function validateFilePath(
  relativePath: string,
  repoRoot?: string,
): string {
  // Check for empty path
  if (!relativePath || relativePath.trim().length === 0) {
    throw new FileSecurityError(
      "File path cannot be empty",
      "EMPTY_PATH",
    );
  }

  const trimmedPath = relativePath.trim();

  // Check for absolute path (must be relative)
  if (isAbsolute(trimmedPath)) {
    throw new FileSecurityError(
      "File path must be relative, not absolute",
      "ABSOLUTE_PATH",
    );
  }

  // Check for leading slash (Unix absolute path)
  if (trimmedPath.startsWith("/")) {
    throw new FileSecurityError(
      "File path must be relative, not absolute (starts with /)",
      "ABSOLUTE_PATH",
    );
  }

  // Check for forbidden patterns (traversal, dotfiles, node_modules)
  const patternCheck = checkForbiddenPatterns(trimmedPath);
  if (!patternCheck.isSafe) {
    throw new FileSecurityError(
      `Forbidden path pattern: ${patternCheck.reason}`,
      "FORBIDDEN_PATTERN",
    );
  }

  // Validate file extension is in whitelist
  if (!hasAllowedExtension(trimmedPath)) {
    const lastDotIndex = trimmedPath.lastIndexOf(".");
    const extension =
      lastDotIndex > 0 ? trimmedPath.slice(lastDotIndex) : "none";
    throw new FileSecurityError(
      `File extension "${extension}" is not in allowed list: ${ALLOWED_EXTENSIONS.join(", ")}`,
      "DISALLOWED_EXTENSION",
    );
  }

  // Resolve the path against the repo root
  const root = getRepoRoot(repoRoot);
  const resolvedPath = resolve(root, trimmedPath);

  // Final safety check: ensure resolved path is still within repo root
  // This catches path traversal attempts that might slip through (e.g., via symlinks)
  const normalizedRoot = normalize(root);
  const normalizedResolved = normalize(resolvedPath);

  // Use case-insensitive comparison on Windows
  const platform = process.platform;
  const rootToCheck =
    platform === "win32" ? normalizedRoot.toLowerCase() : normalizedRoot;
  const pathToCheck =
    platform === "win32" ? normalizedResolved.toLowerCase() : normalizedResolved;

  if (!pathToCheck.startsWith(rootToCheck)) {
    throw new FileSecurityError(
      "Resolved path escapes repository root directory",
      "PATH_ESCAPE",
    );
  }

  return resolvedPath;
}

/**
 * Ensures a file path resolves to a location within the repository root.
 * Uses fs.realpath() to resolve symlinks before checking.
 *
 * This is a secondary defense-in-depth check that should be used
 * after validateFilePath() for critical operations.
 *
 * @param filePath - The file path to check (can be absolute or relative)
 * @param repoRoot - Optional repository root override
 * @returns Promise resolving to true if file is within repo, false otherwise
 */
export async function ensureFileIsWithinRepo(
  filePath: string,
  repoRoot?: string,
): Promise<boolean> {
  try {
    const root = getRepoRoot(repoRoot);

    // Resolve symlinks and get canonical paths
    const resolvedFilePath = await realpath(resolve(filePath));
    const resolvedRepoRoot = await realpath(root);

    // Normalize paths for comparison
    const normalizedFile = normalize(resolvedFilePath);
    const normalizedRoot = normalize(resolvedRepoRoot);

    // Case-insensitive comparison on Windows
    const platform = process.platform;
    const fileToCompare =
      platform === "win32" ? normalizedFile.toLowerCase() : normalizedFile;
    const rootToCompare =
      platform === "win32" ? normalizedRoot.toLowerCase() : normalizedRoot;

    // Check if file path starts with repo root
    return (
      fileToCompare === rootToCompare ||
      fileToCompare.startsWith(rootToCompare + "/") ||
      fileToCompare.startsWith(rootToCompare + "\\")
    );
  } catch {
    // If realpath fails (file doesn't exist, permission denied, etc.),
    // conservatively return false for security
    return false;
  }
}

/**
 * Checks if a file exists and is accessible.
 *
 * @param filePath - The path to check
 * @returns Promise resolving to true if file exists and is readable
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
