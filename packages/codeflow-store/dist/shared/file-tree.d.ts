/**
 * Information about a file or directory in the repository.
 */
export interface FileInfo {
    path: string;
    name: string;
    isDirectory: boolean;
}
/**
 * Recursively scans a repository path for files matching allowed extensions.
 * Returns a flat array of FileInfo objects for all matching files.
 *
 * @param repoPath - The root path to scan
 * @returns Promise resolving to an array of FileInfo objects
 */
export declare function scanRepoFiles(repoPath: string): Promise<FileInfo[]>;
//# sourceMappingURL=file-tree.d.ts.map