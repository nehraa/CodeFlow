/**
 * Permission system for codeflow-agent.
 *
 * Controls whether nodes require user approval before execution
 * based on the selected permission mode.
 */
/**
 * Risk levels for node risk assessment.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * Permission modes:
 * - yolo: No approvals, auto-execute all nodes
 * - always-ask: Approve every node before execution
 * - important: Only approve high-risk nodes (high/critical risk)
 */
export type PermissionMode = 'yolo' | 'always-ask' | 'important';
/**
 * Permission decision for a node.
 */
export interface PermissionDecision {
    nodeId: string;
    approved: boolean;
    reason: string;
    mode: PermissionMode;
}
/**
 * Permission configuration.
 */
export interface PermissionConfig {
    mode: PermissionMode;
    highRiskThreshold?: RiskLevel;
}
/**
 * Interactive confirmation handler type.
 */
export type InteractiveConfirmFn = (message: string) => Promise<boolean>;
/**
 * Permission manager for controlling node execution approval.
 */
export declare class PermissionManager {
    private config;
    private interactiveConfirm;
    constructor(config: PermissionConfig, interactiveConfirm?: InteractiveConfirmFn);
    /**
     * Default confirmation prompt (can be overridden for testing).
     */
    private defaultConfirm;
    /**
     * Check if a node needs approval based on its risk level and permission mode.
     */
    needsApproval(nodeId: string, riskLevel: RiskLevel): boolean;
    /**
     * Request approval for a node.
     *
     * In yolo mode, always returns true.
     * In always-ask mode, prompts the user interactively.
     * In important mode, only prompts for high/critical risk nodes.
     */
    requestApproval(nodeId: string, prompt: string, code: string | null): Promise<boolean>;
    /**
     * Make a permission decision for a node.
     */
    decide(nodeId: string, riskLevel: RiskLevel, prompt: string, code: string | null): Promise<PermissionDecision>;
}
/**
 * Convert a risk level to an ordinal for comparison.
 */
export declare function riskLevelOrdinal(level: RiskLevel): number;
/**
 * Check if a risk level meets or exceeds a threshold.
 */
export declare function riskMeetsThreshold(level: RiskLevel, threshold: RiskLevel): boolean;
//# sourceMappingURL=manager.d.ts.map