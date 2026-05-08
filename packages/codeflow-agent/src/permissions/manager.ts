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
  highRiskThreshold?: RiskLevel; // default: 'medium'
}

/**
 * Interactive confirmation handler type.
 */
export type InteractiveConfirmFn = (message: string) => Promise<boolean>;

/**
 * Permission manager for controlling node execution approval.
 */
export class PermissionManager {
  private config: PermissionConfig;
  private interactiveConfirm: InteractiveConfirmFn;

  constructor(config: PermissionConfig, interactiveConfirm?: InteractiveConfirmFn) {
    this.config = {
      mode: config.mode,
      highRiskThreshold: config.highRiskThreshold ?? 'medium',
    };
    this.interactiveConfirm = interactiveConfirm ?? this.defaultConfirm;
  }

  /**
   * Default confirmation prompt (can be overridden for testing).
   */
  private async defaultConfirm(message: string): Promise<boolean> {
    // In a real implementation, this would use readline or similar
    // For now, we log and return false (deny by default in non-yolo modes)
    console.log(`[PermissionManager] ${message}`);
    console.log('[PermissionManager] Enable yolo mode to skip approvals');
    return false;
  }

  /**
   * Check if a node needs approval based on its risk level and permission mode.
   */
  needsApproval(nodeId: string, riskLevel: RiskLevel): boolean {
    switch (this.config.mode) {
      case 'yolo':
        return false; // Never ask
      case 'always-ask':
        return true; // Always ask
      case 'important':
        // Only ask for high or critical risk
        return riskLevel === 'high' || riskLevel === 'critical';
      default:
        return true;
    }
  }

  /**
   * Request approval for a node.
   *
   * In yolo mode, always returns true.
   * In always-ask mode, prompts the user interactively.
   * In important mode, only prompts for high/critical risk nodes.
   */
  async requestApproval(
    nodeId: string,
    prompt: string,
    code: string | null
  ): Promise<boolean> {
    // yolo mode - never ask, always approve
    if (this.config.mode === 'yolo') {
      return true;
    }

    // always-ask and important modes - prompt user
    console.log(`\n=== Permission Request ===`);
    console.log(`Node: ${nodeId}`);
    console.log(`Mode: ${this.config.mode}`);
    if (code) {
      console.log(`Generated code (${code.length} chars):`);
      console.log(code.substring(0, 500) + (code.length > 500 ? '...' : ''));
    }
    console.log(`\nPrompt:\n${prompt.substring(0, 300)}${prompt.length > 300 ? '...' : ''}`);

    const confirmed = await this.interactiveConfirm(`Approve node ${nodeId}?`);

    return confirmed;
  }

  /**
   * Make a permission decision for a node.
   */
  async decide(nodeId: string, riskLevel: RiskLevel, prompt: string, code: string | null): Promise<PermissionDecision> {
    const needsApproval = this.needsApproval(nodeId, riskLevel);

    if (!needsApproval) {
      return {
        nodeId,
        approved: true,
        reason: `${this.config.mode} mode: no approval needed`,
        mode: this.config.mode,
      };
    }

    const approved = await this.requestApproval(nodeId, prompt, code);

    return {
      nodeId,
      approved,
      reason: approved ? 'User approved' : 'User denied',
      mode: this.config.mode,
    };
  }
}

/**
 * Convert a risk level to an ordinal for comparison.
 */
export function riskLevelOrdinal(level: RiskLevel): number {
  switch (level) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
  }
}

/**
 * Check if a risk level meets or exceeds a threshold.
 */
export function riskMeetsThreshold(level: RiskLevel, threshold: RiskLevel): boolean {
  return riskLevelOrdinal(level) >= riskLevelOrdinal(threshold);
}