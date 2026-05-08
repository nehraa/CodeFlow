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
export { sendToOpencodeServer, clearOpencodeSession, type OpencodeClientOptions, type SendToOpencodeResult, type OpenCodeProvider } from './opencode-client.js';
export { requestMiniMaxChatCompletion, streamMiniMaxChatCompletion, isMiniMaxConfigured, type MiniMaxChatMessage, type MiniMaxChatOptions } from './minimax-client.js';

// Permission system
export { PermissionManager, riskLevelOrdinal, riskMeetsThreshold } from '../permissions/manager.js';
export type { PermissionMode, PermissionDecision, PermissionConfig, InteractiveConfirmFn } from '../permissions/manager.js';

// RiskLevel is used by permission system - re-export from permissions/manager
export type { RiskLevel } from '../permissions/manager.js';