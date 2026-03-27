import type {
  BlueprintNode,
  CodeContract,
  ContractCheck,
  ContractField,
  ExecutionStepStatus
} from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

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

const VERIFIABLE_SCALAR_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "null",
  "undefined",
  "void",
  "object",
  "any",
  "unknown"
]);

const normalizeContract = (contract: Partial<CodeContract>): CodeContract => ({
  ...emptyContract(),
  ...contract
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toPreviewString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 177)}...` : value;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized.length > 300 ? `${serialized.slice(0, 297)}...` : serialized;
  } catch {
    return String(value);
  }
};

const toSerializedValue = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

const splitUnionTypes = (type: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < type.length; index += 1) {
    const char = type[index];

    if (char === "<" || char === "(" || char === "[") {
      depth += 1;
    } else if (char === ">" || char === ")" || char === "]") {
      depth = Math.max(0, depth - 1);
    } else if (char === "|" && depth === 0) {
      parts.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }

  const tail = type.slice(start).trim();
  return [...parts, tail].filter(Boolean);
};

const inferValueType = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
};

const evaluateTypeMatch = (
  expectedType: string,
  value: unknown
): { matches: boolean; verifiable: boolean; actualType: string; message?: string } => {
  const trimmedType = expectedType.trim();
  const actualType = inferValueType(value);

  if (!trimmedType || trimmedType === "void") {
    return {
      matches: value === undefined || value === null,
      verifiable: true,
      actualType
    };
  }

  const unionTypes = splitUnionTypes(trimmedType);
  if (unionTypes.length > 1) {
    const unionMatches = unionTypes
      .map((candidate) => evaluateTypeMatch(candidate, value))
      .find((candidate) => candidate.matches);

    return unionMatches ?? {
      matches: false,
      verifiable: unionTypes.every((candidate) => VERIFIABLE_SCALAR_TYPES.has(candidate)),
      actualType
    };
  }

  if (trimmedType.startsWith("Array<") && trimmedType.endsWith(">")) {
    if (!Array.isArray(value)) {
      return { matches: false, verifiable: true, actualType };
    }

    const childType = trimmedType.slice(6, -1).trim();
    const childResults = value.map((item) => evaluateTypeMatch(childType, item));

    return {
      matches: childResults.every((result) => result.matches),
      verifiable: childResults.every((result) => result.verifiable),
      actualType
    };
  }

  if (trimmedType.endsWith("[]")) {
    return evaluateTypeMatch(`Array<${trimmedType.slice(0, -2)}>`, value);
  }

  if (trimmedType === "string") {
    return { matches: typeof value === "string", verifiable: true, actualType };
  }

  if (trimmedType === "number" || trimmedType === "bigint") {
    return { matches: typeof value === trimmedType, verifiable: true, actualType };
  }

  if (trimmedType === "boolean") {
    return { matches: typeof value === "boolean", verifiable: true, actualType };
  }

  if (trimmedType === "object" || trimmedType.startsWith("Record<")) {
    return { matches: isPlainObject(value), verifiable: true, actualType };
  }

  if (trimmedType === "null") {
    return { matches: value === null, verifiable: true, actualType };
  }

  if (trimmedType === "undefined") {
    return { matches: typeof value === "undefined", verifiable: true, actualType };
  }

  if (trimmedType === "any" || trimmedType === "unknown") {
    return {
      matches: true,
      verifiable: false,
      actualType,
      message: `Expected type ${trimmedType} is too broad for strict runtime verification.`
    };
  }

  if (trimmedType.startsWith("Promise<")) {
    return {
      matches: true,
      verifiable: false,
      actualType,
      message: `Runtime values are validated after awaiting; ${trimmedType} cannot be fully verified here.`
    };
  }

  const looksCustomType = /^[A-Za-z_$][A-Za-z0-9_$<>, ]*$/.test(trimmedType);
  if (looksCustomType) {
    if (value === null || typeof value === "undefined") {
      return { matches: false, verifiable: false, actualType };
    }

    return {
      matches: isPlainObject(value) || Array.isArray(value),
      verifiable: false,
      actualType,
      message: `Custom type ${trimmedType} cannot be fully verified without a richer schema.`
    };
  }

  return {
    matches: true,
    verifiable: false,
    actualType,
    message: `Type ${trimmedType} is not a supported strict runtime type.`
  };
};

const fieldKeyCandidates = (value: string): string[] => {
  const trimmed = value.trim();
  const condensed = trimmed.replace(/[^A-Za-z0-9_$]+/g, "");
  const kebabFree = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const tail = trimmed.split(/[.:/]/).pop() ?? trimmed;

  return [...new Set([trimmed, condensed, kebabFree, tail, tail.toLowerCase()])];
};

const resolveCheckStatus = (checks: ContractCheck[]): ExecutionStepStatus => {
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  if (checks.every((check) => check.status === "skipped")) {
    return "skipped";
  }

  return "passed";
};

const validateFieldValue = (
  stage: ContractCheck["stage"],
  field: ContractField,
  actualValue: unknown
): ContractCheck => {
  const match = evaluateTypeMatch(field.type, actualValue);

  if (!match.matches) {
    return {
      stage,
      status: "failed",
      expected: `${field.name}: ${field.type}`,
      actualPreview: toPreviewString(actualValue),
      message: `Expected ${field.name} to match ${field.type}, received ${match.actualType}.`
    };
  }

  if (!match.verifiable) {
    return {
      stage,
      status: "warning",
      expected: `${field.name}: ${field.type}`,
      actualPreview: toPreviewString(actualValue),
      message:
        match.message ??
        `Accepted ${field.name}, but ${field.type} could not be fully verified at runtime.`
    };
  }

  return {
    stage,
    status: "passed",
    expected: `${field.name}: ${field.type}`,
    actualPreview: toPreviewString(actualValue),
    message: `Validated ${field.name} against ${field.type}.`
  };
};

export const resolveExecutableContract = (
  node: BlueprintNode
): ExecutableContractSurface => {
  const normalizedContract = normalizeContract(node.contract);

  if (node.kind === "class" && normalizedContract.methods.length > 0) {
    const method = normalizedContract.methods[0];
    return {
      methodName: method?.name,
      inputs: method?.inputs ?? [],
      outputs: method?.outputs ?? []
    };
  }

  return {
    inputs: normalizedContract.inputs,
    outputs: normalizedContract.outputs
  };
};

export const previewRuntimeValue = (value: unknown): string => toPreviewString(value);

export const serializeRuntimeValue = (value: unknown): string | undefined => toSerializedValue(value);

export const inferRuntimeValueType = (value: unknown): string => inferValueType(value);

export const validateNodeInvocationInput = (
  node: BlueprintNode,
  input: unknown
): InvocationValidationResult => {
  const executableContract = resolveExecutableContract(node);
  const { inputs } = executableContract;

  if (inputs.length === 0) {
    return {
      status: "passed",
      checks: [],
      args: [],
      normalizedInput: input
    };
  }

  let args: unknown[];

  if (inputs.length === 1) {
    args = [input];
  } else if (Array.isArray(input)) {
    args = input;
  } else if (isPlainObject(input)) {
    args = inputs.map((field) => input[field.name]);
  } else {
    return {
      status: "failed",
      checks: [
        {
          stage: "input",
          status: "failed",
          expected: `${inputs.length} structured input values`,
          actualPreview: toPreviewString(input),
          message: `Expected ${inputs.length} inputs for ${node.name}, but the runtime input was not an array or object.`
        }
      ],
      args: [],
      normalizedInput: input
    };
  }

  const checks = inputs.map((field, index) => validateFieldValue("input", field, args[index]));

  return {
    status: resolveCheckStatus(checks),
    checks,
    args,
    normalizedInput: input
  };
};

const resolveOutputFieldValue = (
  field: ContractField,
  output: unknown,
  outputCount: number
): unknown => {
  if (outputCount === 1) {
    if (isPlainObject(output) && field.name in output) {
      return output[field.name];
    }

    return output;
  }

  if (isPlainObject(output)) {
    return output[field.name];
  }

  return undefined;
};

export const validateNodeOutput = (
  node: BlueprintNode,
  output: unknown
): ValidationResult => {
  const executableContract = resolveExecutableContract(node);
  const { outputs } = executableContract;

  if (outputs.length === 0) {
    return {
      status:
        typeof output === "undefined" || output === null
          ? "passed"
          : "warning",
      checks:
        typeof output === "undefined" || output === null
          ? []
          : [
              {
                stage: "output",
                status: "warning",
                expected: "no declared outputs",
                actualPreview: toPreviewString(output),
                message: `${node.name} returned data even though the blueprint contract declares no outputs.`
              }
            ]
    };
  }

  const checks = outputs.map((field) =>
    validateFieldValue("output", field, resolveOutputFieldValue(field, output, outputs.length))
  );

  return {
    status: resolveCheckStatus(checks),
    checks
  };
};

export const resolveHandoffInputField = (
  sourceNode: BlueprintNode,
  targetNode: BlueprintNode
): ContractField | undefined => {
  const targetInputs = resolveExecutableContract(targetNode).inputs;

  if (targetInputs.length === 1) {
    return targetInputs[0];
  }

  const candidates = new Set([
    ...fieldKeyCandidates(sourceNode.id),
    ...fieldKeyCandidates(sourceNode.name)
  ]);

  return targetInputs.find((field) =>
    fieldKeyCandidates(field.name).some((candidate) => candidates.has(candidate))
  );
};

export const validateEdgeHandoff = (
  sourceNode: BlueprintNode,
  targetNode: BlueprintNode,
  value: unknown
): ValidationResult => {
  const targetField = resolveHandoffInputField(sourceNode, targetNode);

  if (!targetField) {
    return {
      status: "warning",
      checks: [
        {
          stage: "handoff",
          status: "warning",
          expected: `${targetNode.name} input contract`,
          actualPreview: toPreviewString(value),
          message: `Could not map the output from ${sourceNode.name} to a specific input field on ${targetNode.name}.`
        }
      ]
    };
  }

  const check = validateFieldValue("handoff", targetField, value);

  return {
    status: resolveCheckStatus([check]),
    checks: [check]
  };
};

export const summarizeExecutionStepCounts = (
  statuses: ExecutionStepStatus[]
): {
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  warning: number;
} => ({
  passed: statuses.filter((status) => status === "passed").length,
  failed: statuses.filter((status) => status === "failed").length,
  blocked: statuses.filter((status) => status === "blocked").length,
  skipped: statuses.filter((status) => status === "skipped").length,
  warning: statuses.filter((status) => status === "warning").length
});
