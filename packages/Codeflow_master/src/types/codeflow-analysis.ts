/**
 * Type definitions for @abhinav2203/codeflow-analysis
 * Analysis engine for codebase metrics and insights
 */

export interface AnalysisReport {
  file: string;
  metrics: {
    lines: number;
    complexity: number;
    maintainability: number;
  };
  issues: AnalysisIssue[];
  suggestions?: Suggestion[];
}

export interface AnalysisIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  rule?: string;
  fix?: string;
}

export interface Suggestion {
  type: 'optimization' | 'refactor' | 'best-practice';
  message: string;
  line?: number;
  effort?: 'low' | 'medium' | 'high';
}

export interface CodeMetrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  files: number;
  averageFileLength: number;
  largestFile?: {
    path: string;
    lines: number;
  };
}

export interface AnalysisEngine {
  initialize(): Promise<void>;
  analyzeFile(filePath: string, content: string): Promise<AnalysisReport>;
  analyzeProject(projectPath: string): Promise<CodeMetrics>;
  getResults(): AnalysisReport[];
  clearCache(): void;
  getSummary(): {
    totalFiles: number;
    totalIssues: number;
    averageComplexity: number;
  };
}

export interface AnalysisConfig {
  maxFileSize?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
  rules?: {
    maxComplexity?: number;
    maxLineLength?: number;
    requireDocumentation?: boolean;
  };
}

export interface ComplexityBreakdown {
  file: string;
  functionComplexity: {
    name: string;
    line: number;
    complexity: number;
  }[];
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
}