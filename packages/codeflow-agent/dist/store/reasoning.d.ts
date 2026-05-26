export interface AgentReasoningStep {
    agentId: string;
    thought: string;
    action: string;
    timestamp: string;
    output?: string;
    error?: string;
}
export interface ReasoningTrace {
    sessionId: string;
    phase: string;
    projectName: string;
    steps: AgentReasoningStep[];
    startedAt: string;
    updatedAt?: string;
}
/**
 * Saves a complete reasoning trace to the file system.
 */
export declare function saveReasoningTrace(projectName: string, trace: ReasoningTrace): Promise<void>;
/**
 * Appends a reasoning step to an existing trace or creates a new one.
 */
export declare function appendReasoningStep(projectName: string, sessionId: string, phase: string, step: AgentReasoningStep): Promise<void>;
/**
 * Loads a reasoning trace from the file system.
 */
export declare function loadReasoningTrace(projectName: string, sessionId: string, phase: string): Promise<ReasoningTrace | null>;
//# sourceMappingURL=reasoning.d.ts.map