import type { Edge, Node } from "@xyflow/react";

import type { HeatmapData } from "@/lib/blueprint/heatmap";
import { heatColor, heatGlow } from "@/lib/blueprint/heatmap";
import type {
  BlueprintGraph,
  BlueprintNode,
  ContractCheck,
  ContractField,
  ExecutionArtifact,
  ExecutionStep,
  ExecutionStepKind,
  ExecutionStepStatus,
  GhostNode,
  MethodSpec,
  RuntimeExecutionResult,
  RuntimeTestCase,
  RuntimeTestResult,
  ExecutionSummary,
  TraceStatus
} from "@/lib/blueprint/schema";
import { emptyContract } from "@/lib/blueprint/schema";

export type NodeHealthState = "neutral" | "aligned" | "drift" | "heal" | "ghost";

export type FlowExecutionStatus = ExecutionStepStatus | "idle";

export type FlowExecutionState = {
  status: FlowExecutionStatus;
  source: "direct" | "aggregated" | "inferred" | "fallback";
  kind?: ExecutionStepKind;
  stepId?: string;
  runId?: string;
  message?: string;
  durationMs?: number;
  blockedByStepId?: string;
  inputPreview?: string;
  outputPreview?: string;
  stdout?: string;
  stderr?: string;
  artifactIds?: string[];
  contractChecks?: ContractCheck[];
  childStepIds?: string[];
  stepCount?: number;
};

export type FlowExecutionIndex = {
  runId?: string;
  entryNodeId?: string;
  summary?: ExecutionSummary;
  stepsById: Record<string, ExecutionStep>;
  stepsByNodeId: Record<string, ExecutionStep[]>;
  stepsByEdgeId: Record<string, ExecutionStep[]>;
  testCasesByNodeId: Record<string, RuntimeTestCase[]>;
  testResultsByNodeId: Record<string, RuntimeTestResult[]>;
  artifactsById: Record<string, ExecutionArtifact>;
};

export type FlowExecutionProjection = {
  index: FlowExecutionIndex;
  nodeStates: Record<string, FlowExecutionState>;
  edgeStates: Record<string, FlowExecutionState>;
};

export type FlowNodeData = {
  label: string;
  summary: string;
  kind: string;
  traceStatus: TraceStatus;
  healthState: NodeHealthState;
  selected: boolean;
  isActiveBatch: boolean;
  isGhost: boolean;
  drilldownNodeId?: string;
  ghost?: boolean;
  ghostReason?: string;
  execution?: FlowExecutionState;
};

export type InspectorSection = {
  title: string;
  items: string[];
};

export type DetailFlowItem = {
  id: string;
  label: string;
  summary: string;
  kind: string;
  signature?: string;
  path?: string;
  drilldownNodeId?: string;
  execution?: FlowExecutionState;
  sections: InspectorSection[];
};

export type DetailFlowGraph = {
  items: DetailFlowItem[];
  nodes: Array<Node<FlowNodeData>>;
  edges: Edge[];
};

const kindOrder: Record<BlueprintNode["kind"], number> = {
  "ui-screen": 0,
  api: 1,
  module: 2,
  class: 3,
  function: 4
};

const kindTheme = (
  kind: BlueprintNode["kind"],
  selected: boolean,
  traceStatus: TraceStatus
): Node<FlowNodeData>["style"] => {
  const palette: Record<BlueprintNode["kind"], { border: string; glow: string; accent: string }> = {
    "ui-screen": {
      border: "var(--node-ui-border)",
      glow: "var(--node-ui-glow)",
      accent: "var(--node-ui-bg)"
    },
    api: {
      border: "var(--node-api-border)",
      glow: "var(--node-api-glow)",
      accent: "var(--node-api-bg)"
    },
    module: {
      border: "var(--node-module-border)",
      glow: "var(--node-module-glow)",
      accent: "var(--node-module-bg)"
    },
    class: {
      border: "var(--node-class-border)",
      glow: "var(--node-class-glow)",
      accent: "var(--node-class-bg)"
    },
    function: {
      border: "var(--node-function-border)",
      glow: "var(--node-function-glow)",
      accent: "var(--node-function-bg)"
    }
  };
  const theme = palette[kind];
  const traceRing =
    traceStatus === "error"
      ? "rgba(239, 68, 68, 0.28)"
      : traceStatus === "warning"
        ? "rgba(245, 158, 11, 0.24)"
        : traceStatus === "success"
          ? "rgba(34, 197, 94, 0.22)"
          : theme.glow;

  return {
    width: 252,
    borderRadius: 26,
    border: selected ? `1.5px solid ${theme.border}` : "1px solid var(--node-border-default)",
    background: `linear-gradient(180deg, var(--surface-raised) 0%, ${theme.accent} 100%)`,
    padding: 14,
    boxShadow: selected
      ? `0 24px 56px ${traceRing}, inset 0 1px 0 var(--node-inner-shine)`
      : `0 16px 38px ${theme.glow}, inset 0 1px 0 var(--node-inner-shine)`,
    backdropFilter: "blur(14px)"
  };
};

const detailKindColor = (kind: string): string => {
  switch (kind) {
    case "root":
      return "var(--node-module-bg)";
    case "blueprint-node":
      return "var(--node-class-bg)";
    case "attribute":
      return "rgba(250, 204, 21, 0.18)";
    case "method":
      return "rgba(52, 211, 153, 0.16)";
    case "input":
      return "rgba(129, 140, 248, 0.18)";
    case "output":
      return "rgba(251, 113, 133, 0.16)";
    case "dependency":
      return "rgba(251, 146, 60, 0.16)";
    case "call":
      return "rgba(56, 189, 248, 0.16)";
    case "error":
      return "rgba(248, 113, 113, 0.16)";
    case "side-effect":
      return "rgba(250, 204, 21, 0.12)";
    case "note":
      return "rgba(148, 163, 184, 0.16)";
    default:
      return "rgba(148, 163, 184, 0.16)";
  }
};

const executionStatusRank: Record<FlowExecutionStatus, number> = {
  failed: 0,
  blocked: 1,
  running: 2,
  pending: 3,
  warning: 4,
  passed: 5,
  skipped: 6,
  idle: 7
};

const executionStatusLabel: Record<FlowExecutionStatus, string> = {
  failed: "Failed",
  blocked: "Blocked",
  running: "Running",
  pending: "Pending",
  warning: "Warning",
  passed: "Passed",
  skipped: "Skipped",
  idle: "Idle"
};

const executionStatusTone: Record<Exclude<FlowExecutionStatus, "idle">, string> = {
  failed: "rgba(239, 68, 68, 0.24)",
  blocked: "rgba(245, 158, 11, 0.22)",
  running: "rgba(59, 130, 246, 0.22)",
  pending: "rgba(100, 116, 139, 0.18)",
  warning: "rgba(251, 146, 60, 0.20)",
  passed: "rgba(34, 197, 94, 0.22)",
  skipped: "rgba(148, 163, 184, 0.18)"
};

const executionStatusBorderTone: Record<Exclude<FlowExecutionStatus, "idle">, string> = {
  failed: "rgba(239, 68, 68, 0.42)",
  blocked: "rgba(245, 158, 11, 0.40)",
  running: "rgba(59, 130, 246, 0.42)",
  pending: "rgba(100, 116, 139, 0.34)",
  warning: "rgba(251, 146, 60, 0.38)",
  passed: "rgba(34, 197, 94, 0.42)",
  skipped: "rgba(148, 163, 184, 0.34)"
};

const executionStatusClassName = (status?: FlowExecutionStatus): string | undefined =>
  status && status !== "idle" ? `execution-status-${status}` : undefined;

const previewExecutionMessage = (message?: string): string | null => {
  if (!message) {
    return null;
  }

  return message.length > 130 ? `${message.slice(0, 127)}...` : message;
};

const uniqueStrings = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

const formatContractCheck = (check: ContractCheck): string =>
  `${check.stage}: ${check.status}${check.expected ? ` · expected ${check.expected}` : ""}${check.message ? ` - ${check.message}` : ""}`;

const formatTestCase = (testCase: RuntimeTestCase): string =>
  `${testCase.title} [${testCase.kind}]${testCase.notes.length ? ` - ${testCase.notes.join("; ")}` : ""}`;

const formatTestResult = (result: RuntimeTestResult): string =>
  `${result.title}: ${result.status}${result.message ? ` - ${result.message}` : ""}`;

const summarizeExecutionStates = (states: FlowExecutionState[]): FlowExecutionState | undefined => {
  const activeStates = states.filter((state) => state.status !== "idle");

  if (!activeStates.length) {
    return undefined;
  }

  const sorted = [...activeStates].sort((left, right) => executionStatusRank[left.status] - executionStatusRank[right.status]);
  const representative = sorted[0];
  const isDirect = activeStates.length === 1 && representative.source === "direct";
  const aggregatedChecks = uniqueContractChecks(activeStates.flatMap((state) => state.contractChecks ?? []));

  return {
    ...representative,
    source: isDirect ? representative.source : representative.source === "direct" ? "aggregated" : representative.source,
    status: representative.status,
    contractChecks: aggregatedChecks.length ? aggregatedChecks : representative.contractChecks,
    artifactIds: uniqueStrings(activeStates.flatMap((state) => state.artifactIds ?? [])),
    childStepIds: uniqueStrings([
      ...activeStates.flatMap((state) => state.childStepIds ?? []),
      ...activeStates.map((state) => state.stepId)
    ]),
    stepCount: activeStates.reduce((count, state) => count + (state.stepCount ?? 1), 0)
  };
};

const uniqueContractChecks = (checks: ContractCheck[]): ContractCheck[] => {
  const seen = new Set<string>();

  return checks.filter((check) => {
    const signature = `${check.stage}:${check.status}:${check.expected ?? ""}:${check.actualPreview ?? ""}:${check.message}`;
    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
};

const aggregateExecutionState = (
  directState: FlowExecutionState | undefined,
  childStates: FlowExecutionState[]
): FlowExecutionState | undefined => {
  const combinedStates = [...(directState ? [directState] : []), ...childStates].filter(
    (state): state is FlowExecutionState => Boolean(state) && state.status !== "idle"
  );

  if (!combinedStates.length) {
    return directState?.status === "idle" ? directState : undefined;
  }

  const summarized = summarizeExecutionStates(combinedStates);
  if (!summarized) {
    return directState;
  }

  return directState && directState.status !== "idle" && combinedStates.length === 1
    ? directState
    : summarized;
};

const summarizeSteps = (steps: ExecutionStep[]): FlowExecutionState | undefined => {
  if (!steps.length) {
    return undefined;
  }

  const sorted = [...steps].sort((left, right) => {
    const statusDelta = executionStatusRank[left.status] - executionStatusRank[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (
      new Date(right.completedAt || right.startedAt).getTime() -
      new Date(left.completedAt || left.startedAt).getTime()
    );
  });

  const representative = sorted[0];
  const contractChecks = uniqueContractChecks(steps.flatMap((step) => step.contractChecks));

  return {
    status: representative.status,
    source: steps.length === 1 ? "direct" : "aggregated",
    kind: representative.kind,
    stepId: representative.id,
    runId: representative.runId,
    message: representative.message,
    durationMs: steps.reduce((total, step) => total + step.durationMs, 0),
    blockedByStepId: representative.blockedByStepId,
    inputPreview: representative.inputPreview,
    outputPreview: representative.outputPreview,
    stdout: representative.stdout || undefined,
    stderr: representative.stderr || undefined,
    artifactIds: uniqueStrings(steps.flatMap((step) => step.artifactIds)),
    contractChecks: contractChecks.length ? contractChecks : undefined,
    childStepIds: steps.map((step) => step.id),
    stepCount: steps.length
  };
};

export const indexRuntimeExecutionResult = (
  result?: RuntimeExecutionResult | null
): FlowExecutionIndex | null => {
  if (!result) {
    return null;
  }

  const steps = result.steps ?? [];
  const testCases = result.testCases ?? [];
  const testResults = result.testResults ?? [];
  const stepsByNodeId: Record<string, ExecutionStep[]> = {};
  const stepsByEdgeId: Record<string, ExecutionStep[]> = {};
  const testCasesByNodeId: Record<string, RuntimeTestCase[]> = {};
  const testResultsByNodeId: Record<string, RuntimeTestResult[]> = {};
  const testsByCaseId = new Map(testCases.map((testCase) => [testCase.id, testCase] as const));
  const artifactsById: Record<string, ExecutionArtifact> = {};

  for (const artifact of result.artifacts ?? []) {
    artifactsById[artifact.id] = artifact;
  }

  for (const step of steps) {
    (stepsByNodeId[step.nodeId] ??= []).push(step);
    if (step.edgeId) {
      (stepsByEdgeId[step.edgeId] ??= []).push(step);
    }
  }

  for (const testCase of testCases) {
    (testCasesByNodeId[testCase.nodeId] ??= []).push(testCase);
  }

  for (const testResult of testResults) {
    const testCase = testsByCaseId.get(testResult.caseId);
    if (!testCase) {
      continue;
    }

    (testResultsByNodeId[testCase.nodeId] ??= []).push(testResult);
  }

  return {
    runId: result.runId,
    entryNodeId: result.entryNodeId,
    summary: result.summary,
    stepsById: Object.fromEntries(steps.map((step) => [step.id, step] as const)),
    stepsByNodeId,
    stepsByEdgeId,
    testCasesByNodeId,
    testResultsByNodeId,
    artifactsById
  };
};

export const buildExecutionProjection = (
  graph: BlueprintGraph,
  executionResult?: RuntimeExecutionResult | null
): FlowExecutionProjection | null => {
  const index = indexRuntimeExecutionResult(executionResult);
  if (!index) {
    return null;
  }

  const nodeStateCache = new Map<string, FlowExecutionState | undefined>();

  const resolveNodeState = (nodeId: string): FlowExecutionState | undefined => {
    if (nodeStateCache.has(nodeId)) {
      return nodeStateCache.get(nodeId);
    }

    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      nodeStateCache.set(nodeId, undefined);
      return undefined;
    }

    const directState = summarizeSteps(index.stepsByNodeId[node.id] ?? []);
    const childStates = graph.nodes
      .filter((candidate) => candidate.ownerId === node.id)
      .map((candidate) => resolveNodeState(candidate.id))
      .filter((state): state is FlowExecutionState => Boolean(state));

    const resolvedState = aggregateExecutionState(directState, childStates);
    nodeStateCache.set(node.id, resolvedState);
    return resolvedState;
  };

  const nodeStates: Record<string, FlowExecutionState> = {};
  for (const node of graph.nodes) {
    const state = resolveNodeState(node.id);
    if (state) {
      nodeStates[node.id] = state;
    }
  }

  const edgeStates: Record<string, FlowExecutionState> = {};
  for (const edge of graph.edges) {
    const key = `${edge.kind}:${edge.from}:${edge.to}`;
    const state = resolveEdgeState(edge, index, nodeStates);
    if (state) {
      edgeStates[key] = state;
    }
  }

  return {
    index,
    nodeStates,
    edgeStates
  };
};

const resolveEdgeState = (
  edge: BlueprintGraph["edges"][number],
  index: FlowExecutionIndex,
  nodeStates: Record<string, FlowExecutionState>
): FlowExecutionState | undefined => {
  const directState = summarizeSteps(index.stepsByEdgeId[`${edge.kind}:${edge.from}:${edge.to}`] ?? []);
  if (directState) {
    return directState;
  }

  const sourceState = nodeStates[edge.from];
  const targetState = nodeStates[edge.to];
  const candidateStates = [sourceState, targetState].filter(
    (state): state is FlowExecutionState => Boolean(state) && state.status !== "idle"
  );

  if (!candidateStates.length) {
    return undefined;
  }

  const statuses = candidateStates.map((state) => state.status);
  const status = statuses.includes("failed")
    ? "failed"
    : statuses.includes("blocked")
      ? "blocked"
      : statuses.includes("running")
        ? "running"
        : statuses.includes("warning")
          ? "warning"
          : statuses.includes("passed")
            ? "passed"
            : statuses.includes("skipped")
              ? "skipped"
              : "idle";

  return {
    status,
    source: "inferred",
    kind: "edge",
    message: targetState?.message || sourceState?.message || `Execution inferred from ${edge.label ?? edge.kind}.`,
    stepId: targetState?.stepId ?? sourceState?.stepId,
    runId: targetState?.runId ?? sourceState?.runId,
    durationMs: (sourceState?.durationMs ?? 0) + (targetState?.durationMs ?? 0),
    blockedByStepId: targetState?.blockedByStepId ?? sourceState?.blockedByStepId,
    contractChecks: uniqueContractChecks([
      ...(sourceState?.contractChecks ?? []),
      ...(targetState?.contractChecks ?? [])
    ]),
    artifactIds: uniqueStrings([
      ...(sourceState?.artifactIds ?? []),
      ...(targetState?.artifactIds ?? [])
    ]),
    childStepIds: uniqueStrings([sourceState?.stepId, targetState?.stepId]),
    stepCount: candidateStates.length
  };
};

const buildExecutionSections = (
  execution: FlowExecutionState | undefined,
  nodeId: string,
  projection: FlowExecutionProjection | null
): InspectorSection[] => {
  const sections: InspectorSection[] = [];

  if (execution && execution.status !== "idle") {
    const executionItems = [
      `Status: ${executionStatusLabel[execution.status]}${execution.source ? ` (${execution.source})` : ""}`,
      execution.kind ? `Kind: ${execution.kind}` : null,
      execution.stepId ? `Step: ${execution.stepId}` : null,
      execution.runId ? `Run: ${execution.runId}` : null,
      typeof execution.durationMs === "number" ? `Duration: ${execution.durationMs}ms` : null,
      execution.message ? `Message: ${execution.message}` : null,
      execution.inputPreview ? `Input: ${execution.inputPreview}` : null,
      execution.outputPreview ? `Output: ${execution.outputPreview}` : null,
      execution.blockedByStepId ? `Blocked by: ${execution.blockedByStepId}` : null,
      execution.stdout ? `Stdout: ${previewExecutionMessage(execution.stdout) ?? execution.stdout}` : null,
      execution.stderr ? `Stderr: ${previewExecutionMessage(execution.stderr) ?? execution.stderr}` : null
    ].filter((value): value is string => Boolean(value));

    if (execution.contractChecks?.length) {
      executionItems.push(
        `Checks: ${execution.contractChecks.length}`,
        ...execution.contractChecks.slice(0, 5).map(formatContractCheck)
      );
    }

    if (execution.artifactIds?.length) {
      executionItems.push(`Artifacts: ${execution.artifactIds.length}`);
    }

    sections.push({ title: "Execution", items: executionItems });
  }

  const testCases = projection?.index.testCasesByNodeId[nodeId] ?? [];
  const testResults = projection?.index.testResultsByNodeId[nodeId] ?? [];

  if (testCases.length || testResults.length) {
    const testItems = [
      testCases.length ? `Generated cases: ${testCases.length}` : null,
      ...testCases.slice(0, 5).map(formatTestCase),
      testResults.length ? `Results: ${testResults.length}` : null,
      ...testResults.slice(0, 5).map(formatTestResult)
    ].filter((value): value is string => Boolean(value));

    sections.push({ title: "Tests", items: testItems });
  }

  return sections;
};

const formatField = (field: ContractField): string =>
  `${field.name}: ${field.type}${field.description ? ` - ${field.description}` : ""}`;

const normalizeContract = (contract: Partial<BlueprintNode["contract"]>) => ({
  ...emptyContract(),
  ...contract
});

const formatMethodSummary = (method: MethodSpec): string =>
  method.signature ?? `${method.name}(${method.inputs.map((input) => input.name).join(", ")})`;

const mergeBoxShadow = (nextShadow: string, existingShadow?: string) =>
  existingShadow && existingShadow !== "none" ? `${nextShadow}, ${existingShadow}` : nextShadow;

const resolveNodeHealthState = (node: BlueprintNode, traceStatus: TraceStatus): NodeHealthState => {
  const isGhost =
    (node.status ?? "spec_only") === "spec_only" &&
    !node.sourceRefs.length &&
    !node.generatedRefs.length &&
    !node.traceRefs.length &&
    !node.implementationDraft;

  if (traceStatus === "error" || node.lastVerification?.status === "failure") {
    return "heal";
  }

  if (node.status === "verified" || node.status === "connected") {
    return "aligned";
  }

  if (node.status === "implemented" || Boolean(node.implementationDraft)) {
    return "drift";
  }

  if (isGhost && traceStatus === "idle") {
    return "ghost";
  }

  return "neutral";
};

const applyNodeStateStyles = (
  baseStyle: Node<FlowNodeData>["style"],
  options: {
    healthState: NodeHealthState;
    isActiveBatch: boolean;
    isGhost: boolean;
  }
): Node<FlowNodeData>["style"] => {
  const style = { ...baseStyle };

  if (options.healthState === "aligned") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(34, 197, 94, 0.32), 0 0 30px rgba(34, 197, 94, 0.22)", style.boxShadow);
  }

  if (options.healthState === "drift") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(245, 158, 11, 0.34), 0 0 28px rgba(245, 158, 11, 0.18)", style.boxShadow);
  }

  if (options.healthState === "heal") {
    style.boxShadow = mergeBoxShadow("0 0 0 1px rgba(239, 68, 68, 0.38), 0 0 32px rgba(239, 68, 68, 0.24)", style.boxShadow);
  }

  if (options.isActiveBatch) {
    style.boxShadow = mergeBoxShadow("0 0 0 2px rgba(103, 226, 219, 0.42), 0 0 38px rgba(103, 226, 219, 0.24)", style.boxShadow);
  }

  if (options.isGhost) {
    style.borderStyle = "dashed";
    style.opacity = 0.72;
  }

  return style;
};

const applyExecutionStateStyles = (
  baseStyle: Node<FlowNodeData>["style"],
  execution?: FlowExecutionState
): Node<FlowNodeData>["style"] => {
  if (!execution || execution.status === "idle") {
    return baseStyle;
  }

  const status = execution.status;
  const style = { ...baseStyle };
  const tone = executionStatusTone[status];
  const borderTone = executionStatusBorderTone[status];

  style.boxShadow = mergeBoxShadow(`0 0 0 1px ${borderTone}, 0 0 32px ${tone}`, style.boxShadow);

  if (execution.status === "running") {
    style.outline = `2px solid ${borderTone}`;
  }

  if (execution.status === "blocked") {
    style.borderStyle = "dashed";
  }

  return style;
};

const mergeEdgeClassNames = (...classNames: Array<string | undefined>): string | undefined => {
  const merged = classNames.filter(Boolean).join(" ").trim();
  return merged || undefined;
};

const buildNodeSections = (
  node: BlueprintNode,
  execution?: FlowExecutionState,
  projection?: FlowExecutionProjection | null
): InspectorSection[] => {
  const sections = [
    ...buildExecutionSections(execution, node.id, projection ?? null),
    { title: "Responsibilities", items: normalizeContract(node.contract).responsibilities },
    { title: "Inputs", items: normalizeContract(node.contract).inputs.map(formatField) },
    { title: "Outputs", items: normalizeContract(node.contract).outputs.map(formatField) },
    { title: "Attributes / State", items: normalizeContract(node.contract).attributes.map(formatField) },
    {
      title: "Methods",
      items: normalizeContract(node.contract).methods.map(
        (method) => `${formatMethodSummary(method)} - ${method.summary}`
      )
    },
    { title: "Dependencies", items: normalizeContract(node.contract).dependencies },
    {
      title: "Calls",
      items: normalizeContract(node.contract).calls.map(
        (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
      )
    },
    { title: "Side effects", items: normalizeContract(node.contract).sideEffects },
    { title: "Errors", items: normalizeContract(node.contract).errors },
    { title: "Notes", items: normalizeContract(node.contract).notes }
  ];

  return sections.filter((section) => section.items.length > 0);
};

export const buildFlowNodes = (
  graph: BlueprintGraph,
  selectedNodeId?: string,
  heatmapData?: HeatmapData,
  activeNodeIds?: string[],
  driftedNodeIds?: string[],
  executionResult?: RuntimeExecutionResult | null
): Array<Node<FlowNodeData>> => {
  const rowCounts = new Map<number, number>();
  const heatMetricByNodeId =
    heatmapData?.nodes != null
      ? new Map(heatmapData.nodes.map((m) => [m.nodeId, m] as const))
      : undefined;
  const activeNodeIdSet = new Set(activeNodeIds ?? []);
  const driftedNodeIdSet = new Set(driftedNodeIds ?? []);
  const projection = buildExecutionProjection(graph, executionResult);

  return graph.nodes.map((node) => {
    const column = kindOrder[node.kind];
    const row = rowCounts.get(column) ?? 0;
    rowCounts.set(column, row + 1);

    const traceStatus = node.traceState?.status ?? "idle";
    const heatMetric = heatMetricByNodeId?.get(node.id);
    const intensity = heatMetric?.heatIntensity ?? 0;
    const isActiveBatch = activeNodeIdSet.has(node.id);
    const isDrifted = driftedNodeIdSet.has(node.id);
    // Drifted nodes are forced to the "heal" health state so they render with
    // the red highlight that signals the architecture needs attention.
    const healthState = isDrifted ? "heal" : resolveNodeHealthState(node, traceStatus);
    const isGhost = healthState === "ghost";

    const baseStyle = kindTheme(node.kind, selectedNodeId === node.id, traceStatus);
    const baseBoxShadow = baseStyle?.boxShadow;
    const combinedBoxShadow =
      baseBoxShadow && baseBoxShadow !== "none"
        ? `${heatGlow(intensity)}, ${String(baseBoxShadow)}`
        : heatGlow(intensity);
    const baseBackground = baseStyle?.background;
    const heatBackground = `linear-gradient(180deg, ${heatColor(intensity)} 0%, transparent 100%)`;
    const execution = projection?.nodeStates[node.id];

    const heatStyle: Node<FlowNodeData>["style"] =
      intensity > 0
        ? {
            ...baseStyle,
            // Layer the heat gradient over the existing background to avoid nested gradients.
            background: baseBackground
              ? `${heatBackground}, ${String(baseBackground)}`
              : heatBackground,
            boxShadow: combinedBoxShadow,
            outline:
              intensity > 0.66
                ? `2px solid rgba(239,68,68,${(0.3 + intensity * 0.5).toFixed(2)})`
                : intensity > 0.33
                  ? `2px solid rgba(245,158,11,${(0.2 + intensity * 0.4).toFixed(2)})`
                  : undefined
          }
        : baseStyle;
    const executionStyle = applyExecutionStateStyles(heatStyle, execution);
    const stateStyle = applyNodeStateStyles(executionStyle, {
      healthState,
      isActiveBatch,
      isGhost
    });

    return {
      id: node.id,
      type: "policyNode",
      position: {
        x: 80 + column * 280,
        y: 80 + row * 180
      },
      data: {
        label: node.name,
        summary: node.summary,
        kind: node.kind,
        traceStatus,
        healthState,
        selected: selectedNodeId === node.id,
        isActiveBatch,
        isGhost,
        execution
      },
      style: stateStyle,
      className: [
        intensity > 0.66
          ? "node-pulse-hot"
          : intensity > 0.33
            ? "node-pulse-warm"
            : traceStatus !== "idle"
              ? "node-pulse-active"
              : undefined,
        healthState === "aligned" ? "node-health-aligned" : undefined,
        healthState === "drift" ? "node-health-drift" : undefined,
        healthState === "heal" ? "node-health-heal" : undefined,
        executionStatusClassName(execution?.status),
        isGhost ? "node-ghost" : undefined,
        isActiveBatch ? "node-batch-focus" : undefined,
        isDrifted ? "node-drift-shake" : undefined
      ]
        .filter(Boolean)
        .join(" ")
    };
  });
};

export const buildFlowEdges = (
  graph: BlueprintGraph,
  activeNodeIds?: string[],
  executionResult?: RuntimeExecutionResult | null
): Edge[] => {
  const activeNodeIdSet = new Set(activeNodeIds ?? []);
  const projection = buildExecutionProjection(graph, executionResult);

  return graph.edges.map((edge) => {
    const isActive = activeNodeIdSet.has(edge.from) || activeNodeIdSet.has(edge.to);
    const execution = projection?.edgeStates[`${edge.kind}:${edge.from}:${edge.to}`];
    const shouldAnimate = isActive || execution?.status === "running";
    const executionClassName =
      execution?.status && execution.status !== "idle" ? `edge-flow-${execution.status}` : undefined;
    const edgeStroke =
      execution?.status === "failed"
        ? "rgba(239, 68, 68, 0.92)"
        : execution?.status === "blocked"
          ? "rgba(245, 158, 11, 0.92)"
          : execution?.status === "running"
            ? "rgba(59, 130, 246, 0.92)"
            : execution?.status === "warning"
              ? "rgba(251, 146, 60, 0.92)"
              : execution?.status === "passed"
                ? "rgba(34, 197, 94, 0.92)"
                : execution?.status === "skipped"
                  ? "rgba(148, 163, 184, 0.92)"
                  : edge.kind === "calls"
                    ? "var(--flow-edge-strong)"
                    : "var(--flow-edge)";

    return {
      id: `${edge.kind}:${edge.from}:${edge.to}`,
      source: edge.from,
      target: edge.to,
      label: edge.label ?? edge.kind,
      animated: shouldAnimate,
      className: mergeEdgeClassNames(executionClassName ?? (isActive ? "edge-flow-active" : "edge-flow-idle")),
      style: {
        strokeWidth: execution?.status && execution.status !== "idle" ? 2.8 : isActive ? 2.7 : edge.required ? 2.4 : 1.4,
        stroke: edgeStroke,
        strokeDasharray:
          execution?.status === "blocked"
            ? "6 5"
            : execution?.status === "running"
              ? "4 4"
              : execution?.status === "warning"
                ? "8 4"
                : execution?.status === "skipped"
                  ? "10 6"
                  : undefined
      },
      labelStyle: {
        fill: "var(--muted)",
        fontSize: 12,
        fontWeight: 600
      }
    };
  });
};

export const buildGhostFlowNodes = (
  ghostNodes: GhostNode[],
  existingNodes: Array<Node<FlowNodeData>>
): Array<Node<FlowNodeData>> => {
  // Place ghost nodes offset from the rightmost existing node column so they
  // are visually distinct and don't overlap regular nodes.
  const maxX = existingNodes.reduce((acc, n) => Math.max(acc, (n.position?.x ?? 0) + 280), 80);
  const column = maxX;

  return ghostNodes.map((ghost, index) => ({
    id: ghost.id,
    position: {
      x: column,
      y: 80 + index * 180
    },
    data: {
      label: ghost.name,
      summary: ghost.summary,
      kind: ghost.kind,
      traceStatus: "idle" as TraceStatus,
      healthState: "ghost",
      selected: false,
      isActiveBatch: false,
      isGhost: true,
      ghost: true,
      ghostReason: ghost.reason,
      execution: undefined
    },
    style: {
      width: 252,
      borderRadius: 24,
      border: "1.5px dashed rgba(139, 92, 246, 0.55)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(237,233,254,0.45) 100%)",
      padding: 18,
      boxShadow: "0 8px 24px rgba(139, 92, 246, 0.12)",
      backdropFilter: "blur(10px)",
      opacity: 0.72,
      cursor: "pointer"
    }
  }));
};

const createDetailNode = (
  item: DetailFlowItem,
  position: { x: number; y: number },
  selectedId?: string
): Node<FlowNodeData> => ({
  id: item.id,
  type: "policyNode",
  position,
  data: {
    label: item.label,
    summary: item.summary,
    kind: item.kind,
    traceStatus: "idle",
    healthState: "neutral",
    selected: selectedId === item.id,
    isActiveBatch: false,
    isGhost: false,
    drilldownNodeId: item.drilldownNodeId,
    execution: item.execution
  },
  style: {
    width: 240,
    borderRadius: 22,
    border: selectedId === item.id ? "1.5px solid var(--accent-2)" : "1px solid var(--node-border-default)",
    background:
      item.execution && item.execution.status !== "idle"
        ? `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${detailKindColor(item.kind)} 100%)`
        : `linear-gradient(180deg, var(--surface-raised) 0%, ${detailKindColor(item.kind)} 100%)`,
    padding: 14,
    boxShadow:
      item.execution && item.execution.status !== "idle"
        ? `0 0 0 1px ${executionStatusBorderTone[item.execution.status as Exclude<FlowExecutionStatus, "idle">]}, 0 18px 36px rgba(15, 23, 42, 0.12)`
        : "0 18px 36px rgba(15, 23, 42, 0.12)"
  },
  className: mergeEdgeClassNames(
    executionStatusClassName(item.execution?.status),
    item.execution?.status === "blocked" ? "node-execution-blocked" : undefined
  )
});

export const buildDetailFlow = (
  graph: BlueprintGraph,
  rootNodeId: string,
  selectedItemId?: string,
  executionResult?: RuntimeExecutionResult | null
): DetailFlowGraph | null => {
  const rootNode = graph.nodes.find((node) => node.id === rootNodeId);
  if (!rootNode) {
    return null;
  }
  const projection = buildExecutionProjection(graph, executionResult);
  const rootContract = normalizeContract(rootNode.contract);
  const rootExecution = projection?.nodeStates[rootNode.id];

  const items: DetailFlowItem[] = [];
  const edges: Edge[] = [];
  const itemIdsByBlueprintNodeId = new Map<string, string>();
  const rootItemId = `detail:root:${rootNode.id}`;

  items.push({
    id: rootItemId,
    label: rootNode.name,
    summary: rootNode.summary,
    kind: "root",
    signature: rootNode.signature,
    path: rootNode.path,
    execution: rootExecution,
    sections: buildNodeSections(rootNode, rootExecution, projection)
  });
  itemIdsByBlueprintNodeId.set(rootNode.id, rootItemId);

  const ownedNodes = graph.nodes.filter((node) => node.ownerId === rootNode.id);

  for (const ownedNode of ownedNodes) {
    const itemId = `detail:blueprint:${ownedNode.id}`;
    const execution = projection?.nodeStates[ownedNode.id];
    items.push({
      id: itemId,
      label: ownedNode.name,
      summary: ownedNode.summary,
      kind: "blueprint-node",
      signature: ownedNode.signature,
      path: ownedNode.path,
      drilldownNodeId: ownedNode.id,
      execution,
      sections: buildNodeSections(ownedNode, execution, projection)
    });
    itemIdsByBlueprintNodeId.set(ownedNode.id, itemId);
    edges.push({
      id: `${rootItemId}:contains:${itemId}`,
      source: rootItemId,
      target: itemId,
      label: "contains"
    });
  }

  for (const edge of graph.edges) {
    const source = itemIdsByBlueprintNodeId.get(edge.from);
    const target = itemIdsByBlueprintNodeId.get(edge.to);

    if (!source || !target || source === target) {
      continue;
    }

    edges.push({
      id: `detail:${edge.kind}:${source}:${target}`,
      source,
      target,
      label: edge.label ?? edge.kind,
      animated: edge.kind === "calls",
      style: {
        strokeWidth: edge.required ? 2 : 1
      }
    });
  }

  const addSatelliteItems = (
    kind: DetailFlowItem["kind"],
    values: string[],
    relation: string
  ) => {
    values.forEach((value, index) => {
      const itemId = `detail:${kind}:${rootNode.id}:${index}`;
      const execution = kind === "method" ? undefined : rootExecution;
      items.push({
        id: itemId,
        label: value.split(" - ")[0] ?? value,
        summary: value,
        kind,
        execution,
        sections: [
          ...buildExecutionSections(execution, rootNode.id, projection),
          { title: "Details", items: [value] }
        ]
      });
      edges.push({
        id: `${rootItemId}:${relation}:${itemId}`,
        source: rootItemId,
        target: itemId,
        label: relation
      });
    });
  };

  if (rootContract.attributes.length) {
    addSatelliteItems("attribute", rootContract.attributes.map(formatField), "state");
  }

  if (ownedNodes.length === 0 && rootContract.methods.length) {
    rootContract.methods.forEach((method, index) => {
      const itemId = `detail:method:${rootNode.id}:${index}`;
      const matchingMethodSteps =
        projection?.index.stepsByNodeId[rootNode.id]?.filter(
          (step) => step.kind === "method" && (step.methodName === method.name || step.methodName === method.signature)
        ) ?? [];
      const methodExecution = summarizeSteps(matchingMethodSteps) ?? rootExecution;
      items.push({
        id: itemId,
        label: method.name,
        summary: method.summary,
        kind: "method",
        signature: method.signature,
        execution: methodExecution,
        sections: [
          ...buildExecutionSections(methodExecution, rootNode.id, projection),
          { title: "Inputs", items: method.inputs.map(formatField) },
          { title: "Outputs", items: method.outputs.map(formatField) },
          { title: "Side effects", items: method.sideEffects },
          {
            title: "Calls",
            items: method.calls.map(
              (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
            )
          }
        ].filter((section) => section.items.length > 0)
      });
      edges.push({
        id: `${rootItemId}:method:${itemId}`,
        source: rootItemId,
        target: itemId,
        label: "method"
      });
    });
  }

  addSatelliteItems("input", rootContract.inputs.map(formatField), "accepts");
  addSatelliteItems("output", rootContract.outputs.map(formatField), "returns");
  addSatelliteItems("dependency", rootContract.dependencies, "depends on");
  addSatelliteItems(
    "call",
    rootContract.calls.map(
      (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
    ),
    "calls"
  );
  addSatelliteItems("error", rootContract.errors, "may fail");
  addSatelliteItems("side-effect", rootContract.sideEffects, "changes");
  addSatelliteItems("note", rootContract.notes, "notes");

  const buckets: Record<string, DetailFlowItem[]> = {
    root: items.filter((item) => item.kind === "root"),
    "blueprint-node": items.filter((item) => item.kind === "blueprint-node"),
    method: items.filter((item) => item.kind === "method"),
    attribute: items.filter((item) => item.kind === "attribute"),
    input: items.filter((item) => item.kind === "input"),
    output: items.filter((item) => item.kind === "output"),
    dependency: items.filter((item) => item.kind === "dependency"),
    call: items.filter((item) => item.kind === "call"),
    error: items.filter((item) => item.kind === "error"),
    "side-effect": items.filter((item) => item.kind === "side-effect"),
    note: items.filter((item) => item.kind === "note")
  };

  const positions = new Map<string, { x: number; y: number }>();
  const layout = (
    kind: keyof typeof buckets,
    column: number,
    startY: number,
    gapY: number
  ) => {
    buckets[kind].forEach((item, index) => {
      positions.set(item.id, {
        x: 80 + column * 280,
        y: startY + index * gapY
      });
    });
  };

  layout("root", 1, 160, 160);
  layout("blueprint-node", 2, 80, 160);
  layout("method", 2, 80 + buckets["blueprint-node"].length * 170, 160);
  layout("attribute", 0, 80, 130);
  layout("input", 0, 320, 120);
  layout("output", 3, 80, 120);
  layout("dependency", 3, 260, 120);
  layout("call", 3, 440, 120);
  layout("error", 0, 520, 120);
  layout("side-effect", 2, 420, 120);
  layout("note", 1, 420, 120);

  return {
    items,
    edges,
    nodes: items.map((item) => createDetailNode(item, positions.get(item.id) ?? { x: 80, y: 80 }, selectedItemId))
  };
};
