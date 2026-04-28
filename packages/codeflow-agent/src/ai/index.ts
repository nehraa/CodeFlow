/**
 * AI-powered orchestration for codeflow-agent.
 *
 * Provides blueprint generation via NVIDIA Llama, node prompt building,
 * OpenCode code generation, and permission-based execution control.
 */

// AI modules
export { generateBlueprint, type GenerateBlueprintOptions, type BlueprintGenerationResult } from './blueprint-generator.js';
export { buildNodePrompt, buildAllNodePrompts, estimateNodeRisk, type NodePromptOptions, type NodePromptResult } from './node-prompts.js';
export { generateNodeCode, generateNodeCodeDetailed, type GenerateCodeOptions, type CodeGenerationResult } from './code-generator.js';
export { sendToOpencodeServer, clearOpencodeSession, type OpencodeClientOptions, type SendToOpencodeResult } from './opencode-client.js';

// Permission system
export { PermissionManager, riskLevelOrdinal, riskMeetsThreshold } from '../permissions/manager.js';
export type { PermissionMode, PermissionDecision, PermissionConfig, InteractiveConfirmFn } from '../permissions/manager.js';

// Blueprint types
export type { BlueprintGraph, BlueprintNode, BlueprintEdge, BlueprintNodeKind, BlueprintEdgeKind, BlueprintPhase, NodeStatus, CodeContract, MethodSpec, DesignCall, ContractField, RiskLevel, RiskReport } from '../types/blueprint.js';