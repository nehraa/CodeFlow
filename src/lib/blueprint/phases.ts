import type {
  BlueprintGraph,
  BlueprintNode,
  BlueprintPhase,
  NodeStatus,
  NodeVerification,
  ExecutionStep,
  RuntimeExecutionResult
} from "@/lib/blueprint/schema";
import { generateNodeCode, isCodeBearingNode } from "@/lib/blueprint/codegen";

export const getCodeBearingNodes = (graph: BlueprintGraph): BlueprintNode[] =>
  graph.nodes.filter(isCodeBearingNode);

export const withSpecDrafts = (graph: BlueprintGraph): BlueprintGraph => ({
  ...graph,
  nodes: graph.nodes.map((node) =>
    isCodeBearingNode(node)
      ? {
          ...node,
          status: node.status ?? "spec_only",
          specDraft: node.specDraft ?? generateNodeCode(node, graph) ?? undefined
        }
      : {
          ...node,
          status: node.status ?? "spec_only"
        }
  )
});

export const canCompleteSpecPhase = (graph: BlueprintGraph): boolean =>
  getCodeBearingNodes(graph).every((node) => Boolean(node.specDraft ?? generateNodeCode(node, graph)));

export const canEnterImplementationPhase = (graph: BlueprintGraph): boolean =>
  graph.phase === "spec" && canCompleteSpecPhase(graph);

export const canEnterIntegrationPhase = (graph: BlueprintGraph): boolean =>
  graph.phase === "implementation" &&
  getCodeBearingNodes(graph).length > 0 &&
  getCodeBearingNodes(graph).every((node) => node.status === "verified");

export const setGraphPhase = (graph: BlueprintGraph, phase: BlueprintPhase): BlueprintGraph => ({
  ...graph,
  phase
});

export const updateNodeStatus = (
  graph: BlueprintGraph,
  nodeId: string,
  updater: (node: BlueprintNode) => BlueprintNode
): BlueprintGraph => ({
  ...graph,
  nodes: graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node))
});

export const markNodeImplemented = (
  graph: BlueprintGraph,
  nodeId: string,
  implementationDraft: string
): BlueprintGraph => {
  const nextPhase = graph.phase === "spec" ? "implementation" : graph.phase;
  return {
    ...graph,
    phase: nextPhase,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            specDraft: node.specDraft ?? generateNodeCode(node, graph) ?? undefined,
            implementationDraft,
            status: "implemented" as NodeStatus
          }
        : node
    )
  };
};

export const createNodeVerification = (
  result: RuntimeExecutionResult,
  verifiedAt = new Date().toISOString()
): NodeVerification => ({
  verifiedAt,
  status: result.success ? "success" : "failure",
  stdout: result.stdout,
  stderr: result.stderr,
  exitCode: result.exitCode ?? undefined
});

export const createNodeVerificationFromStep = (
  step: Pick<ExecutionStep, "status" | "stdout" | "stderr" | "completedAt">,
  exitCode?: number | null
): NodeVerification => ({
  verifiedAt: step.completedAt,
  status: step.status === "passed" || step.status === "warning" ? "success" : "failure",
  stdout: step.stdout,
  stderr: step.stderr,
  exitCode: exitCode ?? undefined
});

export const markNodeVerified = (
  graph: BlueprintGraph,
  nodeId: string,
  result: RuntimeExecutionResult
): BlueprintGraph => {
  const verifiedGraph: BlueprintGraph = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            status: result.success ? ("verified" as NodeStatus) : node.status,
            lastVerification: createNodeVerification(result)
          }
        : node
    )
  };

  return canEnterIntegrationPhase(verifiedGraph)
    ? setGraphPhase(verifiedGraph, "integration")
    : verifiedGraph;
};

export const getDefaultExecutionTarget = (graph: BlueprintGraph): BlueprintNode | null => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const workflowTarget = graph.workflows
    .flatMap((workflow) => workflow.steps)
    .map((step) => graph.nodes.find((node) => node.name === step))
    .find((node): node is BlueprintNode => Boolean(node && isCodeBearingNode(node)));

  if (workflowTarget) {
    return workflowTarget;
  }

  const nodesWithIncomingEdges = new Set(graph.edges.map((edge) => edge.to));
  const rootCandidate = graph.nodes.find(
    (node) => isCodeBearingNode(node) && !nodesWithIncomingEdges.has(node.id)
  );

  if (rootCandidate) {
    return rootCandidate;
  }

  return [...nodeMap.values()].find(isCodeBearingNode) ?? null;
};

export const markGraphConnected = (graph: BlueprintGraph): BlueprintGraph => ({
  ...graph,
  phase: "integration",
  nodes: graph.nodes.map((node) =>
    isCodeBearingNode(node) && (node.status === "verified" || node.status === "connected")
      ? {
          ...node,
          status: "connected" as NodeStatus
        }
      : node
  )
});

export const applyExecutionResultToGraph = (
  graph: BlueprintGraph,
  result: RuntimeExecutionResult,
  options: { integrationRun: boolean }
): BlueprintGraph => {
  const latestNodeSteps = new Map(
    result.steps
      .filter((step) => step.kind === "node")
      .map((step) => [step.nodeId, step] as const)
  );

  const nextGraph: BlueprintGraph = {
    ...graph,
    phase: options.integrationRun ? "integration" : graph.phase,
    nodes: graph.nodes.map((node) => {
      const step = latestNodeSteps.get(node.id);
      if (!step) {
        return node;
      }

      const passed = step.status === "passed" || step.status === "warning";
      const failed = step.status === "failed";
      const verification = createNodeVerificationFromStep(
        step,
        node.id === result.entryNodeId ? result.exitCode : undefined
      );

      return {
        ...node,
        status: passed
          ? ((options.integrationRun ? "connected" : "verified") as NodeStatus)
          : node.status,
        lastVerification: failed || passed ? verification : node.lastVerification
      };
    })
  };

  return options.integrationRun && result.success ? markGraphConnected(nextGraph) : nextGraph;
};
