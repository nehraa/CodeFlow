/**
 * Type definitions for @abhinav2203/coderag
 * Standalone code retrieval and MCP server for multi-language repositories
 */

export interface CodeQuery {
  query: string;
  language?: string;
  maxResults?: number;
  filters?: {
    fileExtension?: string;
    minSimilarity?: number;
    maxSimilarity?: number;
  };
}

export interface CodeResult {
  file: string;
  content: string;
  score: number;
  lineStart: number;
  lineEnd: number;
  language?: string;
  matchedTokens?: string[];
}

export interface CodeIndex {
  repository: string;
  files: number;
  lastUpdated: number;
  indexSize?: number;
}

export interface CodeRAGConfig {
  repository: string;
  chunkSize?: number;
  overlap?: number;
  embeddings?: {
    provider: 'openai' | 'local' | 'custom';
    model?: string;
  };
}

export interface CodeRAG {
  initialize(repoPath?: string): Promise<void>;
  indexRepository(repoPath: string): Promise<CodeIndex>;
  query(request: CodeQuery): Promise<CodeResult[]>;
  searchByFilename(filename: string): Promise<CodeResult[]>;
  getIndexes(): CodeIndex[];
  clearCache(): void;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeContext?: boolean;
  contextLines?: number;
}

export interface SearchResult {
  file: string;
  matches: {
    line: number;
    content: string;
    score: number;
  }[];
  totalMatches: number;
}