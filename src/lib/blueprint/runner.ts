import crypto from "node:crypto";
import path from "node:path";

import { getNodeStubPath } from "@/lib/blueprint/codegen";
import { getDefaultExecutionTarget } from "@/lib/blueprint/phases";
import {
  generateRuntimeTestCases,
  runGeneratedRuntimeTests
} from "@/lib/blueprint/runtime-tests";
import {
  inferRuntimeValueType,
  previewRuntimeValue,
  resolveExecutableContract,
  resolveHandoffInputField,
  serializeRuntimeValue,
  summarizeExecutionStepCounts,
  validateEdgeHandoff,
  validateNodeInvocationInput,
  validateNodeOutput
} from "@/lib/blueprint/runtime-contracts";
import { prepareRuntimeWorkspace } from "@/lib/blueprint/runtime-workspace";
import type {
  BlueprintEdge,
  BlueprintGraph,
  BlueprintNode,
  ContractCheck,
  ExecutionArtifact,
  ExecutionStep,
  ExecutionStepStatus,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeTestCase,
  RuntimeTestResult
} from "@/lib/blueprint/schema";

type ExecutionSelection = {
  entryNodeId: string;
  executedNodeId: string;
  leafNodeIds: string[];
  aggregateNodeIds: string[];
  runtimeEdges: BlueprintEdge[];
};

type RuntimeArtifactContext = {
  artifact: ExecutionArtifact;
  sourceStepId: string;
  value: unknown;
};

const SUCCESSFUL_RUNTIME_STEP_STATUSES = new Set<ExecutionStepStatus>(["passed", "warning"]);

const parseExecutionInput = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const isDirectlyRunnableNode = (node: BlueprintNode): boolean =>
  node.kind === "function" || node.kind === "api" || node.kind === "class" || node.kind === "ui-screen";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sanitizeInputKey = (value: string): string => {
  const sanitized = value
    .replace(/[^A-Za-z0-9_$]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");

  return sanitized || "value";
};

const edgeIdFor = (edge: BlueprintEdge): string => `${edge.kind}:${edge.from}:${edge.to}`;

const getOwnerChildrenMap = (graph: BlueprintGraph): Map<string, BlueprintNode[]> => {
  const ownerChildren = new Map<string, BlueprintNode[]>();

  for (const node of graph.nodes) {
    if (!node.ownerId) {
      continue;
    }

    const children = ownerChildren.get(node.ownerId) ?? [];
    children.push(node);
    ownerChildren.set(node.ownerId, children);
  }

  return ownerChildren;
};

const hasOwnedRunnableDescendants = (
  nodeId: string,
  ownerChildren: Map<string, BlueprintNode[]>
): boolean => {
  const children = ownerChildren.get(nodeId) ?? [];
  return children.some((child) => isDirectlyRunnableNode(child) || hasOwnedRunnableDescendants(child.id, ownerChildren));
};

const isRunnableLeafNode = (
  node: BlueprintNode,
  ownerChildren: Map<string, BlueprintNode[]>
): boolean => isDirectlyRunnableNode(node) && !hasOwnedRunnableDescendants(node.id, ownerChildren);

const collectOwnedLeafNodes = (
  rootNodeId: string,
  ownerChildren: Map<string, BlueprintNode[]>
): BlueprintNode[] => {
  const leaves: BlueprintNode[] = [];
  const visit = (nodeId: string) => {
    const children = ownerChildren.get(nodeId) ?? [];

    for (const child of children) {
      if (isRunnableLeafNode(child, ownerChildren)) {
        leaves.push(child);
        continue;
      }

      visit(child.id);
    }
  };

  visit(rootNodeId);
  return leaves;
};

const collectAggregateNodeIds = (
  graph: BlueprintGraph,
  leafNodeIds: string[],
  ownerChildren: Map<string, BlueprintNode[]>
): string[] => {
  const aggregateIds = new Set<string>();
  const leafSet = new Set(leafNodeIds);

  for (const leafNodeId of leafNodeIds) {
    let current = graph.nodes.find((node) => node.id === leafNodeId)?.ownerId;
    while (current) {
      aggregateIds.add(current);
      current = graph.nodes.find((node) => node.id === current)?.ownerId;
    }
  }

  return graph.nodes
    .filter((node) => aggregateIds.has(node.id) || (!leafSet.has(node.id) && hasOwnedRunnableDescendants(node.id, ownerChildren)))
    .map((node) => node.id);
};

const selectExecutionNodes = (
  graph: BlueprintGraph,
  request: RuntimeExecutionRequest
): ExecutionSelection => {
  const ownerChildren = getOwnerChildrenMap(graph);

  if (request.targetNodeId) {
    const targetNode = graph.nodes.find((node) => node.id === request.targetNodeId);
    if (!targetNode) {
      throw new Error(`Node ${request.targetNodeId} was not found.`);
    }

    const leafNodes = isRunnableLeafNode(targetNode, ownerChildren)
      ? [targetNode]
      : collectOwnedLeafNodes(targetNode.id, ownerChildren);

    if (!leafNodes.length) {
      throw new Error(`Node ${targetNode.name} has no independently runnable children.`);
    }

    const leafNodeIds = leafNodes.map((node) => node.id);

    return {
      entryNodeId: targetNode.id,
      executedNodeId: targetNode.id,
      leafNodeIds,
      aggregateNodeIds: [...new Set([targetNode.id, ...collectAggregateNodeIds(graph, leafNodeIds, ownerChildren)])]
        .filter((nodeId) => !leafNodeIds.includes(nodeId)),
      runtimeEdges: graph.edges.filter(
        (edge) => leafNodeIds.includes(edge.from) && leafNodeIds.includes(edge.to)
      )
    };
  }

  const leafNodeIds = graph.nodes
    .filter((node) => isRunnableLeafNode(node, ownerChildren))
    .map((node) => node.id);

  if (!leafNodeIds.length) {
    throw new Error("No independently runnable nodes could be selected for graph execution.");
  }

  const defaultTarget = getDefaultExecutionTarget(graph);

  return {
    entryNodeId: defaultTarget?.id ?? leafNodeIds[0] ?? "",
    executedNodeId: defaultTarget?.id ?? leafNodeIds[0] ?? "",
    leafNodeIds,
    aggregateNodeIds: collectAggregateNodeIds(graph, leafNodeIds, ownerChildren).filter(
      (nodeId) => !leafNodeIds.includes(nodeId)
    ),
    runtimeEdges: graph.edges.filter(
      (edge) => leafNodeIds.includes(edge.from) && leafNodeIds.includes(edge.to)
    )
  };
};

const sortLeafNodesForExecution = (graph: BlueprintGraph, leafNodeIds: string[], edges: BlueprintEdge[]): string[] => {
  const graphOrder = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const incomingCounts = new Map(leafNodeIds.map((nodeId) => [nodeId, 0]));
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
    const targets = outgoing.get(edge.from) ?? [];
    targets.push(edge.to);
    outgoing.set(edge.from, targets);
  }

  const queue = leafNodeIds
    .filter((nodeId) => (incomingCounts.get(nodeId) ?? 0) === 0)
    .sort((left, right) => (graphOrder.get(left) ?? 0) - (graphOrder.get(right) ?? 0));
  const ordered: string[] = [];

  while (queue.length) {
    const nextNodeId = queue.shift();
    if (!nextNodeId) {
      continue;
    }

    ordered.push(nextNodeId);
    for (const targetNodeId of outgoing.get(nextNodeId) ?? []) {
      const nextCount = (incomingCounts.get(targetNodeId) ?? 0) - 1;
      incomingCounts.set(targetNodeId, nextCount);
      if (nextCount === 0) {
        queue.push(targetNodeId);
        queue.sort((left, right) => (graphOrder.get(left) ?? 0) - (graphOrder.get(right) ?? 0));
      }
    }
  }

  const remainder = leafNodeIds
    .filter((nodeId) => !ordered.includes(nodeId))
    .sort((left, right) => (graphOrder.get(left) ?? 0) - (graphOrder.get(right) ?? 0));

  return [...ordered, ...remainder];
};

const aggregateStatuses = (statuses: ExecutionStepStatus[]): ExecutionStepStatus => {
  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }

  if (statuses.some((status) => status === "blocked")) {
    return "blocked";
  }

  if (statuses.some((status) => status === "warning")) {
    return "warning";
  }

  if (statuses.some((status) => status === "passed")) {
    return "passed";
  }

  return "skipped";
};

const buildArtifact = ({
  sourceNodeId,
  value,
  targetNodeId,
  edgeId,
  declaredType
}: {
  sourceNodeId: string;
  value: unknown;
  targetNodeId?: string;
  edgeId?: string;
  declaredType?: string;
}): ExecutionArtifact => ({
  id: crypto.randomUUID(),
  sourceNodeId,
  targetNodeId,
  edgeId,
  declaredType,
  actualType: inferRuntimeValueType(value),
  preview: previewRuntimeValue(value),
  serializedValue: serializeRuntimeValue(value)
});

const statusMessageFromChecks = (checks: ContractCheck[], fallback: string): string => {
  if (!checks.length) {
    return fallback;
  }

  const failedCheck = checks.find((check) => check.status === "failed");
  if (failedCheck) {
    return failedCheck.message;
  }

  const warningCheck = checks.find((check) => check.status === "warning");
  if (warningCheck) {
    return warningCheck.message;
  }

  return fallback;
};

const createStep = ({
  runId,
  kind,
  nodeId,
  parentNodeId,
  methodName,
  edgeId,
  status,
  startedAt,
  completedAt,
  stdout = "",
  stderr = "",
  message,
  blockedByStepId,
  inputPreview,
  outputPreview,
  artifactIds = [],
  contractChecks = []
}: {
  runId: string;
  kind: ExecutionStep["kind"];
  nodeId: string;
  parentNodeId?: string;
  methodName?: string;
  edgeId?: string;
  status: ExecutionStepStatus;
  startedAt: Date;
  completedAt: Date;
  stdout?: string;
  stderr?: string;
  message: string;
  blockedByStepId?: string;
  inputPreview?: string;
  outputPreview?: string;
  artifactIds?: string[];
  contractChecks?: ContractCheck[];
}): ExecutionStep => ({
  id: crypto.randomUUID(),
  runId,
  kind,
  nodeId,
  parentNodeId,
  methodName,
  edgeId,
  status,
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  stdout,
  stderr,
  message,
  blockedByStepId,
  inputPreview,
  outputPreview,
  artifactIds,
  contractChecks
});

const formatCompileIssue = (issue: { message: string; line?: number; column?: number }): string =>
  `${issue.line != null && issue.column != null ? `L${issue.line}:C${issue.column} ` : ""}${issue.message}`;

const buildCompileFailureResult = ({
  request,
  selection,
  runId,
  startedAt,
  workspaceDir,
  compileDiagnostics,
  compileIssuesByNodeId
}: {
  request: RuntimeExecutionRequest;
  selection: ExecutionSelection;
  runId: string;
  startedAt: number;
  workspaceDir: string;
  compileDiagnostics: string;
  compileIssuesByNodeId: Map<string, Array<{ message: string; line?: number; column?: number }>>;
}): RuntimeExecutionResult & { executedNodeId: string } => {
  const steps: ExecutionStep[] = [];
  const testCases: RuntimeTestCase[] = [];
  const testResults: RuntimeTestResult[] = [];
  const failingStepIds: string[] = [];
  const graph = request.graph;
  const selectedNodeIdSet = new Set([...selection.leafNodeIds, ...selection.aggregateNodeIds]);

  for (const nodeId of selection.leafNodeIds) {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      continue;
    }

    const issues = compileIssuesByNodeId.get(nodeId) ?? [];
    const started = new Date();
    const completed = new Date();
    const step = createStep({
      runId,
      kind: "node",
      nodeId,
      parentNodeId: node.ownerId,
      status: issues.length ? "failed" : "blocked",
      startedAt: started,
      completedAt: completed,
      stderr: issues.length ? issues.map(formatCompileIssue).join("\n") : compileDiagnostics,
      message: issues.length
        ? `Compilation failed for ${node.name}.`
        : `Execution was blocked because the workspace failed to compile before ${node.name} could run.`
    });

    steps.push(step);
    if (issues.length) {
      failingStepIds.push(step.id);
    }
  }

  const ownerChildren = getOwnerChildrenMap(graph);
  const aggregateIds = [...selection.aggregateNodeIds].sort((left, right) => {
    const depth = (nodeId: string): number => {
      let current = graph.nodes.find((node) => node.id === nodeId)?.ownerId;
      let value = 0;
      while (current) {
        value += 1;
        current = graph.nodes.find((node) => node.id === current)?.ownerId;
      }
      return value;
    };

    return depth(right) - depth(left);
  });

  const nodeStepsByNodeId = new Map(
    steps.filter((step) => step.kind === "node").map((step) => [step.nodeId, step] as const)
  );

  for (const aggregateNodeId of aggregateIds) {
    const aggregateNode = graph.nodes.find((node) => node.id === aggregateNodeId);
    if (!aggregateNode) {
      continue;
    }

    const childStatuses = (ownerChildren.get(aggregateNodeId) ?? [])
      .filter((child) => selectedNodeIdSet.has(child.id))
      .map((child) => nodeStepsByNodeId.get(child.id)?.status)
      .filter((status): status is ExecutionStepStatus => Boolean(status));

    if (!childStatuses.length) {
      continue;
    }

    const started = new Date();
    const completed = new Date();
    const step = createStep({
      runId,
      kind: "node",
      nodeId: aggregateNodeId,
      parentNodeId: aggregateNode.ownerId,
      status: aggregateStatuses(childStatuses),
      startedAt: started,
      completedAt: completed,
      message: `Execution evidence for ${aggregateNode.name} is incomplete because child artifacts did not compile.`,
      blockedByStepId: failingStepIds[0]
    });

    steps.push(step);
    nodeStepsByNodeId.set(aggregateNodeId, step);
  }

  const includeGeneratedTests = request.includeGeneratedTests ?? true;
  if (includeGeneratedTests) {
    for (const nodeId of selection.leafNodeIds) {
      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node || node.kind === "ui-screen") {
        continue;
      }

      const cases = generateRuntimeTestCases({ node, seedInput: request.input });
      testCases.push(...cases);

      for (const testCase of cases) {
        const started = new Date();
        const completed = new Date();
        const step = createStep({
          runId,
          kind: "test",
          nodeId,
          status: "blocked",
          startedAt: started,
          completedAt: completed,
          message: `${testCase.title} was blocked because the runtime workspace did not compile.`,
          blockedByStepId: failingStepIds[0],
          inputPreview: testCase.input
        });
        steps.push(step);
        testResults.push({
          caseId: testCase.id,
          title: testCase.title,
          kind: testCase.kind,
          status: "blocked",
          message: step.message,
          stepIds: [step.id]
        });
      }
    }
  }

  const summary = summarizeExecutionStepCounts(steps.map((step) => step.status));

  return {
    success: false,
    stdout: "",
    stderr: compileDiagnostics,
    exitCode: 1,
    durationMs: Date.now() - startedAt,
    executedPath: path.join(workspaceDir, "tsconfig.json"),
    error: "TypeScript compilation failed.",
    runId,
    entryNodeId: selection.entryNodeId,
    steps,
    artifacts: [],
    summary,
    testCases,
    testResults,
    executedNodeId: selection.executedNodeId
  };
};

const buildRuntimeInputFromArtifacts = (
  targetNode: BlueprintNode,
  acceptedArtifacts: Array<{
    value: unknown;
    sourceNode: BlueprintNode;
    fieldName?: string;
  }>
): unknown => {
  const executableContract = resolveExecutableContract(targetNode);

  if (acceptedArtifacts.length === 0) {
    return undefined;
  }

  if (acceptedArtifacts.length === 1 && executableContract.inputs.length <= 1) {
    return acceptedArtifacts[0]?.value;
  }

  return Object.fromEntries(
    acceptedArtifacts.map(({ value, sourceNode, fieldName }) => [
      fieldName ?? sanitizeInputKey(sourceNode.name.split(".").pop() ?? sourceNode.name),
      value
    ])
  );
};

const materializeNodeOutput = (node: BlueprintNode, value: unknown): unknown => {
  if (node.kind === "api" && isPlainObject(value) && "body" in value) {
    return value.body;
  }

  return value;
};

const createAggregateNodeStep = ({
  runId,
  node,
  childSteps
}: {
  runId: string;
  node: BlueprintNode;
  childSteps: ExecutionStep[];
}): ExecutionStep => {
  const startedAt = new Date(
    Math.min(...childSteps.map((step) => new Date(step.startedAt).getTime()))
  );
  const completedAt = new Date(
    Math.max(...childSteps.map((step) => new Date(step.completedAt).getTime()))
  );
  const summary = summarizeExecutionStepCounts(childSteps.map((step) => step.status));

  return createStep({
    runId,
    kind: "node",
    nodeId: node.id,
    parentNodeId: node.ownerId,
    status: aggregateStatuses(childSteps.map((step) => step.status)),
    startedAt,
    completedAt,
    message: `${node.name} aggregated ${childSteps.length} child execution step${childSteps.length === 1 ? "" : "s"} (${summary.passed} passed, ${summary.failed} failed, ${summary.blocked} blocked, ${summary.warning} warning).`,
    contractChecks: childSteps.flatMap((step) => step.contractChecks)
  });
};

export const runBlueprint = async (
  request: RuntimeExecutionRequest
): Promise<RuntimeExecutionResult & { executedNodeId: string }> => {
  const startedAt = Date.now();
  const runId = crypto.randomUUID();
  const selection = selectExecutionNodes(request.graph, request);
  const inputValue = parseExecutionInput(request.input);
  const nodeById = new Map(request.graph.nodes.map((node) => [node.id, node]));
  const ownerChildren = getOwnerChildrenMap(request.graph);
  const workspace = await prepareRuntimeWorkspace({
    graph: request.graph,
    codeDrafts: request.codeDrafts
  });

  try {
    const compileIssuesByNodeId = new Map<string, Array<{ message: string; line?: number; column?: number }>>();
    for (const nodeId of selection.leafNodeIds) {
      const stubPath = getNodeStubPath(nodeById.get(nodeId)!);
      const matchedIssues = workspace.compileResult.issues.filter((issue) =>
        stubPath && issue.filePath ? issue.filePath.endsWith(stubPath) : false
      );
      if (matchedIssues.length) {
        compileIssuesByNodeId.set(nodeId, matchedIssues);
      }
    }

    if (!workspace.compileResult.success) {
      return buildCompileFailureResult({
        request,
        selection,
        runId,
        startedAt,
        workspaceDir: workspace.workspaceDir,
        compileDiagnostics: workspace.compileResult.diagnostics,
        compileIssuesByNodeId
      });
    }

    const orderedLeafNodeIds = sortLeafNodesForExecution(
      request.graph,
      selection.leafNodeIds,
      selection.runtimeEdges
    );
    const incomingEdgesByTarget = new Map<string, BlueprintEdge[]>();
    for (const edge of selection.runtimeEdges) {
      const entries = incomingEdgesByTarget.get(edge.to) ?? [];
      entries.push(edge);
      incomingEdgesByTarget.set(edge.to, entries);
    }

    const steps: ExecutionStep[] = [];
    const artifacts: ExecutionArtifact[] = [];
    const nodeStepsByNodeId = new Map<string, ExecutionStep>();
    const artifactBySourceNodeId = new Map<string, RuntimeArtifactContext>();
    const testCases: RuntimeTestCase[] = [];
    const testResults: RuntimeTestResult[] = [];

    for (const nodeId of orderedLeafNodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      const incomingEdges = incomingEdgesByTarget.get(node.id) ?? [];
      const acceptedArtifacts: Array<{
        value: unknown;
        sourceNode: BlueprintNode;
        fieldName?: string;
      }> = [];
      const blockedIncomingStepIds: string[] = [];
      const incomingChecks: ContractCheck[] = [];
      let executionInput = inputValue;

      for (const edge of incomingEdges) {
        const sourceNode = nodeById.get(edge.from);
        const sourceStep = sourceNode ? nodeStepsByNodeId.get(sourceNode.id) : undefined;
        const sourceArtifact = sourceNode ? artifactBySourceNodeId.get(sourceNode.id) : undefined;
        const started = new Date();
        const completed = new Date();

        if (!sourceNode || !sourceStep || !SUCCESSFUL_RUNTIME_STEP_STATUSES.has(sourceStep.status) || !sourceArtifact) {
          const blockedEdgeStep = createStep({
            runId,
            kind: "edge",
            nodeId: node.id,
            parentNodeId: node.ownerId,
            edgeId: edgeIdFor(edge),
            status: "blocked",
            startedAt: started,
            completedAt: completed,
            blockedByStepId: sourceStep?.id,
            message: `Handoff from ${edge.from} to ${node.name} was blocked because the upstream node did not produce verified output.`
          });

          steps.push(blockedEdgeStep);
          if (edge.required) {
            blockedIncomingStepIds.push(blockedEdgeStep.id);
          }
          continue;
        }

        const handoffValidation = validateEdgeHandoff(sourceNode, node, sourceArtifact.value);
        const handoffArtifact = buildArtifact({
          sourceNodeId: sourceNode.id,
          targetNodeId: node.id,
          edgeId: edgeIdFor(edge),
          declaredType: resolveHandoffInputField(sourceNode, node)?.type,
          value: sourceArtifact.value
        });
        artifacts.push(handoffArtifact);

        const edgeStep = createStep({
          runId,
          kind: "edge",
          nodeId: node.id,
          parentNodeId: node.ownerId,
          edgeId: edgeIdFor(edge),
          status: handoffValidation.status,
          startedAt: started,
          completedAt: completed,
          message: statusMessageFromChecks(
            handoffValidation.checks,
            `Validated handoff from ${sourceNode.name} to ${node.name}.`
          ),
          inputPreview: previewRuntimeValue(sourceArtifact.value),
          outputPreview: previewRuntimeValue(sourceArtifact.value),
          artifactIds: [handoffArtifact.id],
          contractChecks: handoffValidation.checks
        });

        steps.push(edgeStep);
        incomingChecks.push(...handoffValidation.checks);
        if (handoffValidation.status === "failed" && edge.required) {
          blockedIncomingStepIds.push(edgeStep.id);
          continue;
        }

        if (handoffValidation.status !== "failed") {
          acceptedArtifacts.push({
            value: sourceArtifact.value,
            sourceNode,
            fieldName: resolveHandoffInputField(sourceNode, node)?.name
          });
        }
      }

      if (incomingEdges.length > 0) {
        executionInput = buildRuntimeInputFromArtifacts(node, acceptedArtifacts);
      }

      if (blockedIncomingStepIds.length > 0) {
        const started = new Date();
        const completed = new Date();
        const blockedStep = createStep({
          runId,
          kind: "node",
          nodeId: node.id,
          parentNodeId: node.ownerId,
          status: "blocked",
          startedAt: started,
          completedAt: completed,
          blockedByStepId: blockedIncomingStepIds[0],
          message: `Execution of ${node.name} was blocked because one or more required upstream handoffs failed validation.`,
          inputPreview: previewRuntimeValue(executionInput),
          contractChecks: incomingChecks
        });
        steps.push(blockedStep);
        nodeStepsByNodeId.set(node.id, blockedStep);
        continue;
      }

      if (node.kind === "ui-screen") {
        const started = new Date();
        const completed = new Date();
        const skippedStep = createStep({
          runId,
          kind: "node",
          nodeId: node.id,
          parentNodeId: node.ownerId,
          status: "skipped",
          startedAt: started,
          completedAt: completed,
          message: `${node.name} compiled with the graph, but UI screens are not directly invoked by the runtime executor yet.`,
          inputPreview: previewRuntimeValue(executionInput)
        });
        steps.push(skippedStep);
        nodeStepsByNodeId.set(node.id, skippedStep);
        continue;
      }

      const inputValidation = validateNodeInvocationInput(node, executionInput);
      if (inputValidation.status === "failed") {
        const started = new Date();
        const completed = new Date();
        const failedStep = createStep({
          runId,
          kind: "node",
          nodeId: node.id,
          parentNodeId: node.ownerId,
          status: "failed",
          startedAt: started,
          completedAt: completed,
          message: statusMessageFromChecks(
            inputValidation.checks,
            `${node.name} rejected the provided input contract.`
          ),
          inputPreview: previewRuntimeValue(executionInput),
          contractChecks: [...incomingChecks, ...inputValidation.checks]
        });
        steps.push(failedStep);
        nodeStepsByNodeId.set(node.id, failedStep);
        continue;
      }

      const invocation = await workspace.invokeNode(node, executionInput, inputValidation.args);
      const outputValue = materializeNodeOutput(node, invocation.output);
      const outputValidation = invocation.success
        ? validateNodeOutput(node, outputValue)
        : { status: "failed" as ExecutionStepStatus, checks: [] };
      const leafStatus: ExecutionStepStatus =
        !invocation.success
          ? "failed"
          : outputValidation.status === "failed"
            ? "failed"
            : inputValidation.status === "warning" || outputValidation.status === "warning"
              ? "warning"
              : "passed";

      let methodStep: ExecutionStep | null = null;

      if (node.kind === "class" && invocation.methodName) {
        methodStep = createStep({
          runId,
          kind: "method",
          nodeId: node.id,
          parentNodeId: node.id,
          methodName: invocation.methodName,
          status: leafStatus,
          startedAt: new Date(Date.now() - invocation.durationMs),
          completedAt: new Date(),
          stdout: invocation.stdout,
          stderr: invocation.stderr,
          message: invocation.success
            ? statusMessageFromChecks(
                [...inputValidation.checks, ...outputValidation.checks],
                `${node.name}.${invocation.methodName} executed successfully.`
              )
            : invocation.error ?? `${node.name}.${invocation.methodName} failed at runtime.`,
          inputPreview: previewRuntimeValue(executionInput),
          outputPreview: previewRuntimeValue(outputValue),
          contractChecks: [...incomingChecks, ...inputValidation.checks, ...outputValidation.checks]
        });
        steps.push(methodStep);
      }

      const nodeArtifact =
        invocation.success
          ? buildArtifact({
              sourceNodeId: node.id,
              declaredType: resolveExecutableContract(node).outputs[0]?.type,
              value: outputValue
            })
          : null;

      if (nodeArtifact) {
        artifacts.push(nodeArtifact);
      }

      const nodeStep =
        methodStep
          ? createAggregateNodeStep({
              runId,
              node,
              childSteps: [methodStep]
            })
          : createStep({
              runId,
              kind: "node",
              nodeId: node.id,
              parentNodeId: node.ownerId,
              status: leafStatus,
              startedAt: new Date(Date.now() - invocation.durationMs),
              completedAt: new Date(),
              stdout: invocation.stdout,
              stderr: invocation.stderr,
              message: invocation.success
                ? statusMessageFromChecks(
                    [...incomingChecks, ...inputValidation.checks, ...outputValidation.checks],
                    `${node.name} executed successfully.`
                  )
                : invocation.error ?? `${node.name} failed at runtime.`,
              inputPreview: previewRuntimeValue(executionInput),
              outputPreview: previewRuntimeValue(outputValue),
              artifactIds: nodeArtifact ? [nodeArtifact.id] : [],
              contractChecks: [...incomingChecks, ...inputValidation.checks, ...outputValidation.checks]
            });

      steps.push(nodeStep);
      nodeStepsByNodeId.set(node.id, nodeStep);

      if (nodeArtifact && SUCCESSFUL_RUNTIME_STEP_STATUSES.has(nodeStep.status)) {
        artifactBySourceNodeId.set(node.id, {
          artifact: nodeArtifact,
          sourceStepId: methodStep?.id ?? nodeStep.id,
          value: outputValue
        });
      }
    }

    const aggregateNodeIds = [...selection.aggregateNodeIds].sort((left, right) => {
      const depth = (nodeId: string): number => {
        let current = nodeById.get(nodeId)?.ownerId;
        let value = 0;
        while (current) {
          value += 1;
          current = nodeById.get(current)?.ownerId;
        }
        return value;
      };

      return depth(right) - depth(left);
    });

    for (const aggregateNodeId of aggregateNodeIds) {
      const aggregateNode = nodeById.get(aggregateNodeId);
      if (!aggregateNode) {
        continue;
      }

      const childSteps = (ownerChildren.get(aggregateNodeId) ?? [])
        .map((child) => nodeStepsByNodeId.get(child.id))
        .filter((step): step is ExecutionStep => Boolean(step));

      if (!childSteps.length) {
        continue;
      }

      const aggregateStep = createAggregateNodeStep({
        runId,
        node: aggregateNode,
        childSteps
      });
      steps.push(aggregateStep);
      nodeStepsByNodeId.set(aggregateNode.id, aggregateStep);
    }

    const includeGeneratedTests = request.includeGeneratedTests ?? true;
    if (includeGeneratedTests) {
      for (const nodeId of orderedLeafNodeIds) {
        const node = nodeById.get(nodeId);
        if (!node || node.kind === "ui-screen") {
          continue;
        }

        const cases = generateRuntimeTestCases({ node, seedInput: request.input });
        testCases.push(...cases);
        const runtimeTests = await runGeneratedRuntimeTests({
          workspace,
          node,
          runId,
          testCases: cases
        });
        steps.push(...runtimeTests.steps);
        testResults.push(...runtimeTests.results);
      }
    }

    const summary = summarizeExecutionStepCounts(steps.map((step) => step.status));
    const success =
      summary.failed === 0 &&
      summary.blocked === 0 &&
      steps.some((step) => step.kind === "node" && SUCCESSFUL_RUNTIME_STEP_STATUSES.has(step.status));

    return {
      success,
      stdout:
        steps
          .filter((step) => step.kind === "node" && step.stdout)
          .map((step) => step.stdout)
          .join("\n")
          .trim() || "",
      stderr:
        steps
          .filter((step) => (step.kind === "node" || step.kind === "method" || step.kind === "test") && step.stderr)
          .map((step) => step.stderr)
          .join("\n")
          .trim() || "",
      exitCode: success ? 0 : 1,
      durationMs: Date.now() - startedAt,
      executedPath: workspace.workspaceDir,
      error: success ? undefined : "Runtime execution failed or was blocked.",
      runId,
      entryNodeId: selection.entryNodeId,
      steps,
      artifacts,
      summary,
      testCases,
      testResults,
      executedNodeId: selection.executedNodeId
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown execution error.",
      exitCode: 1,
      durationMs: Date.now() - startedAt,
      executedPath: workspace.workspaceDir,
      error: error instanceof Error ? error.message : "Unknown execution error.",
      runId,
      entryNodeId: selection.entryNodeId,
      steps: [],
      artifacts: [],
      summary: summarizeExecutionStepCounts([]),
      testCases: [],
      testResults: [],
      executedNodeId: selection.executedNodeId
    };
  } finally {
    await workspace.cleanup();
  }
};
