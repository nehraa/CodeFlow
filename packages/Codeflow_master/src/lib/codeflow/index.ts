/**
 * Codeflow package exports
 * Unified access to all 12 codeflow packages
 */

// Core exports
export {
  analyzeRepository,
  generateBlueprint,
  detectConflicts,
  exportBlueprint,
} from './core';

// Store exports
export {
  useSessionStore,
  getSessionStorage,
  createProjectStore,
} from './store';
export type { Checkpoint, PendingApproval, ApprovedItem } from './store';

// MCP exports
export { getMCPServer, createMCPClient } from './mcp';
export type { ToolDefinition, MCPServerConfig, MCPServer, MCPMessage } from './mcp';

// Execution exports
export {
  getExecutionRuntime,
  executeCode,
  validateCode,
  runTests,
} from './execution';
export type { ExecutionResult, WorkspaceConfig, TestCase, TestResult } from './execution';

// Digital Twin exports
export { getDigitalTwin, useDigitalTwin } from './dtwin';
export type { TwinSnapshot, TwinNode, TwinState, TwinConnection } from './dtwin';

// Evolution exports
export { getEvolutionEngine, useEvolution } from './evolution';
export type {
  GhostNode,
  Genotype,
  EvolutionConfig,
  EvolutionResult,
  EvolutionHistoryEntry,
  DiversityMetrics,
} from './evolution';

// Versioning exports
export { getVersioning, useGitOperations } from './versioning';
export type { VersionInfo, DiffResult, Branch, Commit } from './versioning';

// PRD exports
export { getPRDProcessor, usePRD } from './prd';
export type { PRDDocument, PRDSection, Requirement, PRDParseOptions } from './prd';

// Analysis exports
export { getAnalysisEngine, useAnalysis } from './analysis';
export type {
  AnalysisReport,
  AnalysisIssue,
  CodeMetrics,
  AnalysisConfig,
  ComplexityBreakdown,
  Suggestion,
} from './analysis';

// Agent exports
export { getAgentOrchestrator, useAgentOrchestrator, TaskQueue } from './agent';
export type {
  AgentTask,
  AgentConfig,
  AgentStatus,
  AgentEvent,
  TaskResult,
} from './agent';

// CodeRAG exports
export { getCodeRAG, useCodeSearch, useEmbeddingSearch } from './coderag';
export type { CodeQuery, CodeResult, CodeIndex, SearchOptions, SearchResult } from './coderag';

// Canvas exports
export {
  useCanvasStore,
  useCanvasActions,
} from './canvas';
export type {
  CanvasConfig,
  NodeData,
  EdgeData,
  CanvasState,
  CanvasEventHandlers,
  MiniMapConfig,
  ControlsConfig,
} from './canvas';

// Re-export types index
export * from '@/types';