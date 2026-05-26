import type { BlueprintNode, ContractCheck, ContractField, ExecutionStepStatus } from "@abhinav2203/codeflow-core";
type ValidationResult = {
    status: ExecutionStepStatus;
    checks: ContractCheck[];
};
type InvocationValidationResult = ValidationResult & {
    args: unknown[];
    normalizedInput: unknown;
};
type ExecutableContractSurface = {
    inputs: ContractField[];
    outputs: ContractField[];
    methodName?: string;
};
export declare const resolveExecutableContract: (node: BlueprintNode) => ExecutableContractSurface;
export declare const previewRuntimeValue: (value: unknown) => string;
export declare const serializeRuntimeValue: (value: unknown) => string | undefined;
export declare const inferRuntimeValueType: (value: unknown) => string;
export declare const validateNodeInvocationInput: (node: BlueprintNode, input: unknown) => InvocationValidationResult;
export declare const validateNodeOutput: (node: BlueprintNode, output: unknown) => ValidationResult;
export declare const resolveHandoffInputField: (sourceNode: BlueprintNode, targetNode: BlueprintNode) => ContractField | undefined;
export declare const validateEdgeHandoff: (sourceNode: BlueprintNode, targetNode: BlueprintNode, value: unknown) => ValidationResult;
export declare const summarizeExecutionStepCounts: (statuses: ExecutionStepStatus[]) => {
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    warning: number;
};
export {};
//# sourceMappingURL=runtime-contracts.d.ts.map