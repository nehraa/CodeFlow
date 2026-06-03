/**
 * Type definitions for @abhinav2203/codeflow-versioning
 * Version control and history management
 */

export interface VersionInfo {
  id: string;
  label: string;
  timestamp: number;
  changes: number;
  author?: string;
  message?: string;
  files?: string[];
}

export interface DiffResult {
  file: string;
  additions: number;
  deletions: number;
  changes: string[];
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  lines: string[];
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

export interface VersioningManager {
  initialize(): Promise<void>;
  createVersion(label: string, author?: string): VersionInfo;
  getVersions(): VersionInfo[];
  getCurrentVersion(): VersionInfo | undefined;
  checkout(versionId: string): void;
  diff(v1: string, v2: string): Promise<DiffResult[]>;
  getHistory(days?: number): VersionInfo[];
  merge(fromVersion: string, toVersion: string): Promise<VersionInfo>;
}

export interface Branch {
  id: string;
  name: string;
  head: string;
  createdAt: number;
  updatedAt: number;
}

export interface Commit {
  id: string;
  versionId: string;
  message: string;
  author?: string;
  timestamp: number;
  files: string[];
  parentIds?: string[];
}

export interface VersioningOptions {
  autoCheckpoint?: boolean;
  maxVersions?: number;
  includeMetadata?: boolean;
}