import { describe, expect, it } from "vitest";

import {
  validateFilePath,
  FileSecurityError,
  ensureFileIsWithinRepo,
} from "@/lib/file-security";

// Use a fixed, known absolute root so these pure-function tests are
// deterministic and never need to touch the real filesystem.
const ROOT = "/test/repo";

describe("validateFilePath", () => {
  it("returns the resolved absolute path for a valid relative path", () => {
    const result = validateFilePath("src/app.ts", ROOT);
    expect(result).toBe("/test/repo/src/app.ts");
  });

  it("throws EMPTY_PATH for an empty string", () => {
    expect(() => validateFilePath("", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("EMPTY_PATH");
    }
  });

  it("throws ABSOLUTE_PATH for a path starting with /", () => {
    expect(() => validateFilePath("/etc/passwd", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("/etc/passwd", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("ABSOLUTE_PATH");
    }
  });

  it("throws FORBIDDEN_PATTERN for a plain traversal segment (..)", () => {
    expect(() => validateFilePath("../etc/passwd", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("../etc/passwd", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("FORBIDDEN_PATTERN");
    }
  });

  it("throws FORBIDDEN_PATTERN for traversal embedded in the path", () => {
    // path.normalize would collapse this; we must catch it before normalizing.
    expect(() => validateFilePath("src/../../etc/passwd", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("src/../../etc/passwd", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("FORBIDDEN_PATTERN");
    }
  });

  it("throws FORBIDDEN_PATTERN for dotfiles that normalize would erase (.env/../foo.ts)", () => {
    // ".env/../foo.ts" → after normalize becomes "foo.ts", hiding the dotfile.
    // We validate the raw segments, so it must be rejected.
    expect(() => validateFilePath(".env/../foo.ts", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath(".env/../foo.ts", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("FORBIDDEN_PATTERN");
    }
  });

  it("throws FORBIDDEN_PATTERN for a dotfile like .env", () => {
    expect(() => validateFilePath(".env", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath(".env", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("FORBIDDEN_PATTERN");
    }
  });

  it("throws FORBIDDEN_PATTERN for a path containing node_modules", () => {
    expect(() => validateFilePath("node_modules/lodash/index.ts", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("node_modules/lodash/index.ts", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("FORBIDDEN_PATTERN");
    }
  });

  it("throws DISALLOWED_EXTENSION for .exe", () => {
    expect(() => validateFilePath("malware.exe", ROOT)).toThrow(FileSecurityError);
    try {
      validateFilePath("malware.exe", ROOT);
    } catch (err) {
      expect((err as FileSecurityError).code).toBe("DISALLOWED_EXTENSION");
    }
  });

  it("separator-aware containment: /test/repo2 is not inside /test/repo", () => {
    // The naive startsWith('/test/repo') would incorrectly match
    // '/test/repo2/file.ts'.  After the separator-aware fix the check uses
    // startsWith('/test/repo/'), so '/test/repo2/...' is correctly rejected.
    //
    // validateFilePath always resolves relative to the provided root, so the
    // resolved path for root=/test/repo2 is '/test/repo2/src/index.ts' –
    // we verify it does NOT start with the shorter '/test/repo/' prefix.
    const result = validateFilePath("src/index.ts", "/test/repo2");
    expect(result).toBe("/test/repo2/src/index.ts");
    // Key assertion: the result must not be considered inside '/test/repo'
    expect(result.startsWith("/test/repo/")).toBe(false);
  });
});

describe("ensureFileIsWithinRepo", () => {
  it("returns false for non-existent paths", async () => {
    const result = await ensureFileIsWithinRepo(
      "/nonexistent/path/that/does/not/exist/file.ts",
      "/nonexistent/path/that/does/not/exist",
    );
    expect(result).toBe(false);
  });

  it("resolves a relative path against the repo root, not process.cwd()", async () => {
    // A relative path that is valid under process.cwd() but NOT under a fake root
    // should return false because realpath will fail for the fake root.
    const result = await ensureFileIsWithinRepo(
      "src/lib/file-security.ts",
      "/tmp/nonexistent-root-xyz",
    );
    expect(result).toBe(false);
  });
});
