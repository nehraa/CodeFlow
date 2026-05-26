/**
 * Local blueprint types with multi-language augmentation.
 *
 * Re-exports BlueprintNode from codeflow-core/schema and augments it
 * with the `language` field for Python/Go/Rust support.
 */

import type { BlueprintNode as CoreBlueprintNode } from "@abhinav2203/codeflow-core/schema";

/**
 * Augment the core BlueprintNode with the language field.
 * This allows nodes to specify their target language for code generation.
 */
export interface BlueprintNode extends CoreBlueprintNode {
  /**
   * Target language for code generation. Defaults to 'typescript'.
   * When set, codeflow-agent generates scaffold code in the specified language.
   */
  language?: "typescript" | "python" | "go" | "rust";
}

// Re-export everything else from core schema for convenience
export type {
  BlueprintGraph,
  BlueprintEdge,
  BlueprintNodeKind,
  BlueprintEdgeKind,
  BlueprintPhase,
  NodeStatus,
  CodeContract,
  MethodSpec,
  DesignCall,
  ContractField
} from "@abhinav2203/codeflow-core/schema";

// RiskLevel is defined locally in permissions/manager
export type { RiskLevel } from "../permissions/manager.js";
