/**
 * codeflow-analysis wrapper
 * Analysis engine for codebase metrics and insights
 */
import type {
  AnalysisReport,
  AnalysisIssue,
  CodeMetrics,
  AnalysisEngine,
  AnalysisConfig,
  ComplexityBreakdown,
  Suggestion,
} from '@/types/codeflow-analysis';

// Re-export types
export type { AnalysisReport, AnalysisIssue, CodeMetrics, AnalysisConfig, ComplexityBreakdown, Suggestion };

class AnalysisEngineImpl implements AnalysisEngine {
  private results: Map<string, AnalysisReport> = new Map();
  private cache: Map<string, AnalysisReport> = new Map();
  private config: AnalysisConfig = {
    maxFileSize: 1000000, // 1MB
    excludePatterns: ['node_modules', '.git', 'dist', 'build'],
    includePatterns: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      maxComplexity: 20,
      maxLineLength: 120,
      requireDocumentation: false,
    },
  };

  async initialize(): Promise<void> {
    console.log('[codeflow-analysis] Analysis engine initialized');
  }

  async analyzeFile(filePath: string, content: string): Promise<AnalysisReport> {
    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    const result: AnalysisReport = {
      file: filePath,
      metrics: this.calculateMetrics(content),
      issues: this.detectIssues(content),
      suggestions: this.generateSuggestions(content),
    };

    this.results.set(filePath, result);
    this.cache.set(filePath, result);
    return result;
  }

  private calculateMetrics(content: string) {
    const lines = content.split('\n');
    const codeLines = lines.filter(
      (l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('/*')
    );
    const commentLines = lines.filter(
      (l) => l.trim().startsWith('//') || l.trim().startsWith('/*')
    );
    const blankLines = lines.filter((l) => !l.trim()).length;

    return {
      lines: lines.length,
      complexity: this.calculateComplexity(content),
      maintainability: this.calculateMaintainability(lines.length, commentLines.length),
    };
  }

  private calculateComplexity(content: string): number {
    const patterns = [
      /if\s*\(/g,
      /else\s+/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /case\s+/g,
      /&&|\|\|/g,
      /catch\s*\(/g,
    ];

    let complexity = 1;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    }

    return Math.min(complexity, 100);
  }

  private calculateMaintainability(totalLines: number, commentLines: number): number {
    const commentRatio = commentLines / Math.max(totalLines, 1);
    const baseScore = 100 - totalLines / 100;
    return Math.max(0, Math.min(100, baseScore + commentRatio * 20));
  }

  private detectIssues(content: string): AnalysisIssue[] {
    const issues: AnalysisIssue[] = [];

    // Check for TODO without ticket reference
    const todoMatches = content.match(/TODO(?!\s*\[)/g);
    if (todoMatches) {
      issues.push({
        severity: 'warning',
        message: 'TODO found without ticket reference',
        rule: 'no-orphaned-todo',
      });
    }

    // Check for console.log
    const consoleMatches = content.match(/console\.(log|warn|error)/g);
    if (consoleMatches) {
      issues.push({
        severity: 'info',
        message: `Found ${consoleMatches.length} console statement(s)`,
        rule: 'no-console',
      });
    }

    // Check for long lines
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const maxLen = this.config.rules?.maxLineLength;
      if (maxLen && line.length > maxLen) {
        issues.push({
          severity: 'info',
          message: `Line exceeds ${maxLen} characters`,
          line: i + 1,
          rule: 'max-line-length',
        });
      }
    });

    // Check for unused variables (simplified)
    const unusedVarMatches = content.match(/const\s+\w+\s*=\s*[^;]+;/g);
    if (unusedVarMatches && unusedVarMatches.length > 10) {
      issues.push({
        severity: 'warning',
        message: 'High number of variable declarations - consider refactoring',
        rule: 'complex-declaration',
      });
    }

    return issues;
  }

  private generateSuggestions(content: string): Suggestion[] {
    const suggestions: Suggestion[] = [];

    if (content.length > 5000) {
      suggestions.push({
        type: 'refactor',
        message: 'File exceeds 5000 lines - consider splitting into smaller modules',
        effort: 'high',
      });
    }

    if (!content.includes('//') && !content.includes('/*')) {
      suggestions.push({
        type: 'best-practice',
        message: 'No comments found - consider adding documentation',
        effort: 'low',
      });
    }

    return suggestions;
  }

  async analyzeProject(projectPath: string): Promise<CodeMetrics> {
    // Simplified project analysis - real implementation would traverse files
    return {
      totalLines: 10000,
      codeLines: 7500,
      commentLines: 1500,
      blankLines: 1000,
      files: 50,
      averageFileLength: 200,
      largestFile: {
        path: `${projectPath}/src/large-file.ts`,
        lines: 1500,
      },
    };
  }

  getResults(): AnalysisReport[] {
    return Array.from(this.results.values());
  }

  clearCache(): void {
    this.cache.clear();
  }

  getSummary(): {
    totalFiles: number;
    totalIssues: number;
    averageComplexity: number;
  } {
    const results = this.getResults();
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const avgComplexity =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.metrics.complexity, 0) / results.length
        : 0;

    return {
      totalFiles: results.length,
      totalIssues,
      averageComplexity: Math.round(avgComplexity),
    };
  }
}

// Singleton
let analysis: AnalysisEngine | null = null;

export function getAnalysisEngine(): AnalysisEngine {
  if (!analysis) {
    analysis = new AnalysisEngineImpl();
  }
  return analysis;
}

// React hook for analysis
export function useAnalysis() {
  const engine = getAnalysisEngine();

  return {
    results: engine.getResults(),
    summary: engine.getSummary(),
    analyzeFile: (path: string, content: string) => engine.analyzeFile(path, content),
    analyzeProject: (path: string) => engine.analyzeProject(path),
    clearCache: () => engine.clearCache(),
  };
}