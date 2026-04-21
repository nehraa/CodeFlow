import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * Information about a file or directory in the repository.
 */
export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
}

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);

/**
 * Checks if a file has an allowed extension.
 */
function hasAllowedExtension(fileName: string): boolean {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension);
}

/**
 * Recursively scans a repository path for files matching allowed extensions.
 * Returns a flat array of FileInfo objects for all matching files.
 *
 * @param repoPath - The root path to scan
 * @returns Promise resolving to an array of FileInfo objects
 */
export async function scanRepoFiles(repoPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  async function scanDirectory(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else if (entry.isFile() && hasAllowedExtension(entry.name)) {
        files.push({
          path: fullPath,
          name: basename(entry.name),
          isDirectory: false
        });
      }
    }
  }

  const repoStat = await stat(repoPath);
  if (!repoStat.isDirectory()) {
    throw new Error(`Path is not a directory: ${repoPath}`);
  }

  await scanDirectory(repoPath);

  return files;
}
