/**
 * Type definitions for @abhinav2203/codeflow-core
 * Analysis core for blueprint generation, repository analysis, exports, and conflict detection
 */

export interface BlueprintNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

export interface AnalysisResult {
  file: string;
  metrics: {
    lines: number;
    complexity: number;
    maintainability: number;
  };
  issues: Issue[];
}

export interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  rule?: string;
}

export interface RepositoryAnalysis {
  path: string;
  files: number;
  totalLines: number;
  languageBreakdown: Record<string, number>;
  issues: Issue[];
  timestamp: number;
}

export interface CodeflowCore {
  analyze(path: string): Promise<RepositoryAnalysis>;
  generateBlueprint(spec: BlueprintSpec): Promise<BlueprintNode[]>;
  detectConflicts(projectPath: string): Promise<Conflict[]>;
  exportBlueprint(nodes: BlueprintNode[], format: 'json' | 'yaml' | 'markdown'): string;
}

export interface BlueprintSpec {
  name: string;
  description?: string;
  nodes?: BlueprintNode[];
  options?: {
    includeTests?: boolean;
    includeDocumentation?: boolean;
    targetLanguage?: string;
  };
}

export interface Conflict {
  type: 'naming' | 'import' | 'dependency';
  files: string[];
  message: string;
  severity: 'error' | 'warning';
}

export function createCodeflowCore(): CodeflowCore {
  return {
    async analyze(path) {
      return {
        path,
        files: 0,
        totalLines: 0,
        languageBreakdown: {},
        issues: [],
        timestamp: Date.now(),
      };
    },
    async generateBlueprint(spec) {
      return spec.nodes || [];
    },
    async detectConflicts(projectPath) {
      return [];
    },
    exportBlueprint(nodes, format) {
      if (format === 'json') return JSON.stringify(nodes, null, 2);
      return JSON.stringify(nodes);
    },
  };
}