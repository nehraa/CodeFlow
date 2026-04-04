"use client";

import type { QueryResult, RetrievedNodeContext } from "@abhinav2203/coderag";
import { z } from "zod";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useBlueprintStore } from "@/store/blueprint-store";

import { CodeflowCatLogo } from "@/components/codeflow-brand";
import { CodeEditor } from "@/components/code-editor";
import { CodeflowCatShowcase } from "@/components/codeflow-cat-showcase";
import { FileTabs } from "@/components/file-tabs";
import { FileTree } from "@/components/file-tree";
import { GraphCanvas } from "@/components/graph-canvas";
import { IdeLayout } from "@/components/ide-layout";
import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import { addEdgeToGraph, addNodeToGraph, deleteNodeFromGraph } from "@/lib/blueprint/edit";
import { buildDetailFlow, indexRuntimeExecutionResult } from "@/lib/blueprint/flow-view";
import { computeHeatmap } from "@/lib/blueprint/heatmap";
import type { HeatmapData } from "@/lib/blueprint/heatmap";
import { formatNavigationTarget, getNavigationTarget, isValidNavigationTarget } from "@/lib/blueprint/node-navigation";
import { canEnterImplementationPhase, canEnterIntegrationPhase, setGraphPhase } from "@/lib/blueprint/phases";
import { applyTraceOverlay } from "@/lib/blueprint/traces";
import { frameIndexToPosition, positionToFrameIndex, replayAtFrame } from "@/lib/blueprint/vcr";
import type { CycleReport } from "@/lib/blueprint/cycles";
import type { SmellReport } from "@/lib/blueprint/smells";
import type { GraphMetrics } from "@/lib/blueprint/metrics";
import type { RefactorReport, HealResult } from "@/lib/blueprint/refactor";
import {
  AUTO_IMPLEMENT_STORAGE_KEY,
  LIVE_COMPLETIONS_STORAGE_KEY,
  loadSessionApiKey,
  readFloatingGraph,
  readLocalBooleanPreference,
  readRepoPath,
  storeSessionApiKey,
  writeFloatingGraph,
  writeLocalBooleanPreference,
  writeRepoPath
} from "@/lib/browser/storage";
import type {
  ApprovalRecord,
  BlueprintGraph,
  BlueprintNode,
  BranchDiff,
  ConflictReport,
  DigitalTwinSnapshot,
  ExecutionMode,
  ExportResult,
  ExecutionArtifact,
  ExecutionStep,
  GhostNode,
  GraphBranch,
  McpServerConfig,
  McpTool,
  ObservabilityLog,
  PersistedSession,
  RiskReport,
  RunPlan,
  RuntimeExecutionResult,
  TournamentResult,
  VcrRecording
} from "@/lib/blueprint/schema";
import { emptyContract, traceSpanSchema } from "@/lib/blueprint/schema";

type BuildResponse = {
  graph?: BlueprintGraph;
  runPlan?: RunPlan;
  session?: PersistedSession;
  error?: string;
};

type ExportResponse = {
  result?: ExportResult;
  runPlan?: RunPlan;
  riskReport?: RiskReport;
  session?: PersistedSession;
  approval?: ApprovalRecord;
  requiresApproval?: boolean;
  error?: string;
};

type ExecutionResponse = {
  result?: RuntimeExecutionResult;
  executedNodeId?: string;
  graph?: BlueprintGraph;
  runPlan?: RunPlan;
  session?: PersistedSession;
  error?: string;
};

type ImplementNodeResponse = {
  implementation?: {
    summary: string;
    code: string;
    notes: string[];
  };
  graph?: BlueprintGraph;
  runPlan?: RunPlan;
  session?: PersistedSession;
  error?: string;
};

type ObservabilityLatestResponse = {
  graph?: BlueprintGraph | null;
  latestSpans?: Array<{ spanId: string; name: string; status: string; runtime: string; provenance?: string }>;
  latestLogs?: ObservabilityLog[];
  error?: string;
};

type ConflictResponse = {
  report?: ConflictReport;
  error?: string;
};

type CyclesResponse = {
  report?: CycleReport;
  error?: string;
};

type SmellsResponse = {
  report?: SmellReport;
  error?: string;
};

type MetricsResponse = {
  metrics?: GraphMetrics;
  error?: string;
};

type MermaidResponse = {
  diagram?: string;
  format?: string;
  error?: string;
};

type GhostSuggestionsApiResponse = {
  suggestions?: GhostNode[];
  error?: string;
};

type BuildStatusProbeResponse = {
  serverApiKeyConfigured?: boolean;
};

type CodeSuggestionResponse = {
  summary: string;
  code: string;
  notes: string[];
};

type BranchListResponse = {
  branches?: GraphBranch[];
  error?: string;
};

type BranchCreateResponse = {
  branch?: GraphBranch;
  error?: string;
};

type BranchDiffResponse = {
  diff?: BranchDiff;
  error?: string;
};

type VcrResponse = {
  recording?: VcrRecording;
  error?: string;
};

type CodeRagStatusResponse = {
  status?: "ready" | "not_initialized";
  message?: string;
  details?: Record<string, unknown>;
  error?: string;
};

type CodeRagQueryResponse = {
  results?: QueryResult;
  error?: string;
};

type DigitalTwinResponse = {
  snapshot?: DigitalTwinSnapshot | null;
  graph?: BlueprintGraph | null;
  activeWindowSecs?: number;
  error?: string;
};

type SimulateActionResponse = {
  spans?: Array<{ spanId: string; name: string; runtime: string }>;
  snapshot?: { spans: unknown[] };
  error?: string;
};

type McpToolsResponse = {
  tools?: McpTool[];
  error?: string;
};

type McpInvokeResponse = {
  result?: {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  error?: string;
};

type RefactorDetectResponse = {
  report?: RefactorReport;
  error?: string;
};

type RefactorHealResponse = {
  report?: RefactorReport;
  result?: HealResult;
  error?: string;
};

type StatusTone = "info" | "success" | "danger";
type IdeDockTab = "terminal" | "heatmap" | "vcr" | "traces" | "problems";
type ActivityEntryTone = "info" | "success" | "error" | "command";
type ActivityEntry = {
  id: string;
  source: string;
  message: string;
  tone: ActivityEntryTone;
  timestamp: string;
  detail?: string;
};

const tracesSchema = z.array(traceSpanSchema);

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

const normalizeClientFetchError = (
  error: unknown,
  fallback: string,
  actionLabel: string
): string => {
  if (error instanceof TypeError) {
    const message = error.message.trim();
    if (/failed to fetch|networkerror|load failed|fetch resource/i.test(message)) {
      return `CodeFlow could not reach the local server while trying to ${actionLabel}. Start the app on http://localhost:3000 and reload this page.`;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

const updateNode = (
  graph: BlueprintGraph,
  nodeId: string,
  updater: (node: BlueprintNode) => BlueprintNode
): BlueprintGraph => ({
  ...graph,
  nodes: graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node))
});

const formatField = (field: BlueprintNode["contract"]["inputs"][number]) =>
  `${field.name}: ${field.type}${field.description ? ` - ${field.description}` : ""}`;

const normalizeContract = (contract: Partial<BlueprintNode["contract"]>) => ({
  ...emptyContract(),
  ...contract
});

type ToolbarMenuKey = "brand" | "build" | "view" | "tools" | null;

function ToolbarMenu({
  active,
  label,
  onToggle,
  children
}: {
  active: boolean;
  label: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`toolbar-menu${active ? " is-open" : ""}`}>
      <button
        aria-expanded={active}
        className={`toolbar-menu-trigger${active ? " is-open" : ""}`}
        onClick={onToggle}
        type="button"
      >
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {active ? <div className="toolbar-menu-popover">{children}</div> : null}
    </div>
  );
}

function ToolbarMenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="toolbar-menu-section">
      <p>{title}</p>
      {children}
    </div>
  );
}

export function BlueprintWorkbench() {
  const {
    activeFile,
    floatingGraph,
    graph,
    openFiles,
    repoPath,
    selectedNodeId,
    setActiveFile,
    setFloatingGraph,
    setGraph,
    setOpenFiles,
    setRepoPath,
    setSelectedNodeId
  } = useBlueprintStore();

  const MIN_OBSERVABILITY_INTERVAL_SECS = 2;
  const [projectName, setProjectName] = useState("CodeFlow Workspace");
  const [prdText, setPrdText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [nvidiaApiKey, setNvidiaApiKey] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("essential");
  const [outputDir, setOutputDir] = useState("");
  const [traceInput, setTraceInput] = useState("");
  const [runInput, setRunInput] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [runPlan, setRunPlan] = useState<RunPlan | null>(null);
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [session, setSession] = useState<PersistedSession | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRecord | null>(null);
  const [executionResult, setExecutionResult] = useState<RuntimeExecutionResult | null>(null);
  const [latestLogs, setLatestLogs] = useState<ObservabilityLog[]>([]);
  const [latestSpans, setLatestSpans] = useState<ObservabilityLatestResponse["latestSpans"]>([]);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeKind, setNewNodeKind] = useState<BlueprintNode["kind"]>("function");
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [edgeKind, setEdgeKind] = useState<"calls" | "imports" | "inherits">("calls");
  const [useAI, setUseAI] = useState(true);
  const [drilldownStack, setDrilldownStack] = useState<string[]>([]);
  const [selectedDetailNodeId, setSelectedDetailNodeId] = useState<string | null>(null);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [suggestionInstruction, setSuggestionInstruction] = useState("");
  const [codeSuggestion, setCodeSuggestion] = useState<CodeSuggestionResponse | null>(null);
  const [liveCompletionsEnabled, setLiveCompletionsEnabled] = useState(true);
  const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
  const [apiKeyStatusLoaded, setApiKeyStatusLoaded] = useState(false);
  const [statusTitle, setStatusTitle] = useState("Ready to build");
  const [statusDetail, setStatusDetail] = useState(
    "Enter a project description or repo input, then build a blueprint."
  );
  const [statusTone, setStatusTone] = useState<StatusTone>("info");
  const [activeDockTab, setActiveDockTab] = useState<IdeDockTab>("terminal");
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [codeRagStatus, setCodeRagStatus] = useState<"checking" | "ready" | "not_initialized" | "error">("checking");
  const [codeRagMessage, setCodeRagMessage] = useState("Checking CodeRAG status...");
  const [codeRagQuery, setCodeRagQuery] = useState("");
  const [codeRagDepth, setCodeRagDepth] = useState(2);
  const [codeRagResult, setCodeRagResult] = useState<QueryResult | null>(null);
  const [codeRagError, setCodeRagError] = useState<string | null>(null);
  const [codeRagLoading, setCodeRagLoading] = useState(false);
  const [openToolbarMenu, setOpenToolbarMenu] = useState<ToolbarMenuKey>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showObservabilityPanel, setShowObservabilityPanel] = useState(false);
  const [autoObservability, setAutoObservability] = useState(false);
  const [observabilityIntervalSecs, setObservabilityIntervalSecs] = useState(5);
  const [observabilityPollError, setObservabilityPollError] = useState<string | null>(null);
  const [observabilityLastUpdatedAt, setObservabilityLastUpdatedAt] = useState<string | null>(null);
  const autoObsRef = useRef(autoObservability);
  autoObsRef.current = autoObservability;
  const [autoImplementNodes, setAutoImplementNodes] = useState(false);
  const [cycleReport, setCycleReport] = useState<CycleReport | null>(null);
  const [smellReport, setSmellReport] = useState<SmellReport | null>(null);
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics | null>(null);
  const [mermaidDiagram, setMermaidDiagram] = useState<string | null>(null);
  const [ghostSuggestions, setGhostSuggestions] = useState<GhostNode[]>([]);
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [mcpHeadersJson, setMcpHeadersJson] = useState("{}");
  const [mcpToolName, setMcpToolName] = useState("");
  const [mcpToolArgsJson, setMcpToolArgsJson] = useState("{}");
  const [availableMcpTools, setAvailableMcpTools] = useState<McpTool[]>([]);
  const [mcpInvokeResult, setMcpInvokeResult] = useState<string | null>(null);
  const [mcpError, setMcpError] = useState<string | null>(null);

  // ── Time-Travel Branching ──────────────────────────────────────────────
  const [branches, setBranches] = useState<GraphBranch[]>([]);
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchDescription, setNewBranchDescription] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branchDiff, setBranchDiff] = useState<BranchDiff | null>(null);
  const [diffTargetBranchId, setDiffTargetBranchId] = useState<string | null>(null);

  // ── VCR Time-Travel Debugging ──────────────────────────────────────────
  const [showVcrPanel, setShowVcrPanel] = useState(false);
  const [vcrRecording, setVcrRecording] = useState<VcrRecording | null>(null);
  const [vcrFrameIndex, setVcrFrameIndex] = useState(0);
  const [vcrPlaying, setVcrPlaying] = useState(false);
  const [vcrGraph, setVcrGraph] = useState<BlueprintGraph | null>(null);
  const [vcrError, setVcrError] = useState<string | null>(null);

  // ── Digital Twin: Real-Time Production Mirroring ───────────────────────
  const [showDigitalTwinPanel, setShowDigitalTwinPanel] = useState(false);
  const [digitalTwinSnapshot, setDigitalTwinSnapshot] = useState<DigitalTwinSnapshot | null>(null);
  const [digitalTwinGraph, setDigitalTwinGraph] = useState<BlueprintGraph | null>(null);
  const [digitalTwinWindowSecs, setDigitalTwinWindowSecs] = useState(60);
  const [autoDigitalTwin, setAutoDigitalTwin] = useState(false);
  const autoDigitalTwinRef = useRef(autoDigitalTwin);
  autoDigitalTwinRef.current = autoDigitalTwin;
  const [simulateNodeIds, setSimulateNodeIds] = useState("");
  const [simulateLabel, setSimulateLabel] = useState("");
  const [digitalTwinError, setDigitalTwinError] = useState<string | null>(null);
  const [digitalTwinPollError, setDigitalTwinPollError] = useState<string | null>(null);
  const [digitalTwinLastUpdatedAt, setDigitalTwinLastUpdatedAt] = useState<string | null>(null);

  // ── Neural Auto-Refactoring ────────────────────────────────────────────
  const [showRefactorPanel, setShowRefactorPanel] = useState(false);
  const [refactorReport, setRefactorReport] = useState<RefactorReport | null>(null);
  const [healResult, setHealResult] = useState<HealResult | null>(null);
  const [refactorError, setRefactorError] = useState<string | null>(null);
  /**
   * Set to `true` right before a heal replaces the graph so the graph-change
   * effect doesn't immediately wipe the post-heal report.
   */
  const graphReplacedByHealRef = useRef(false);
  /** AbortController for the currently in-flight detect or heal fetch. */
  const refactorAbortRef = useRef<AbortController | null>(null);

  // ── Architectural Genetic Algorithms ──────────────────────────────────────
  const [showGeneticPanel, setShowGeneticPanel] = useState(false);
  const [showMascotPanel, setShowMascotPanel] = useState(false);
  const [showPhasePanel, setShowPhasePanel] = useState(false);
  const [geneticGenerations, setGeneticGenerations] = useState(3);
  const [geneticPopulationSize, setGeneticPopulationSize] = useState(6);
  const [tournamentResult, setTournamentResult] = useState<TournamentResult | null>(null);
  const [geneticError, setGeneticError] = useState<string | null>(null);
  const [editorRevealTarget, setEditorRevealTarget] = useState<ReturnType<typeof getNavigationTarget>>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const drilldownNodeId = drilldownStack.at(-1) ?? null;
  const drilldownRootNode = graph?.nodes.find((node) => node.id === drilldownNodeId) ?? null;
  const executionIndex = useMemo(
    () => indexRuntimeExecutionResult(executionResult),
    [executionResult]
  );
  const detailFlow =
    graph && drilldownNodeId
      ? buildDetailFlow(graph, drilldownNodeId, selectedDetailNodeId ?? undefined, executionResult)
      : null;
  const selectedDetailItem =
    detailFlow?.items.find((item) => item.id === selectedDetailNodeId) ?? detailFlow?.items[0] ?? null;
  const heatmapData: HeatmapData | undefined = useMemo(
    () =>
      graph &&
      graph.nodes.some(
        (node) => node.traceState && node.traceState.count > 0
      )
        ? computeHeatmap(graph)
        : undefined,
    [graph]
  );
  const activeCodeNode =
    graph && drilldownRootNode && isCodeBearingNode(drilldownRootNode)
      ? drilldownRootNode
      : graph && selectedNode && isCodeBearingNode(selectedNode)
        ? selectedNode
        : null;
  const activeCodeDraft =
    graph && activeCodeNode
      ? codeDrafts[activeCodeNode.id] ??
        activeCodeNode.implementationDraft ??
        activeCodeNode.specDraft ??
        generateNodeCode(activeCodeNode, graph) ??
        ""
      : "";
  const activeCodePath = activeCodeNode ? getNodeStubPath(activeCodeNode) : null;
  const executionSummary = executionResult?.summary ?? null;
  const failedExecutionStep = executionResult?.steps.find((step) => step.status === "failed") ?? null;
  const blockedExecutionStep = executionResult?.steps.find((step) => step.status === "blocked") ?? null;
  const liveCompletionReady =
    liveCompletionsEnabled && (Boolean(nvidiaApiKey.trim()) || serverApiKeyConfigured);
  const isBusy = Boolean(busyLabel);
  const isBuilding = busyLabel === "Building blueprint";
  const codeBearingNodeCount = graph?.nodes.filter(isCodeBearingNode).length ?? 0;
  const implementedNodeCount =
    graph?.nodes.filter(
      (node) =>
        isCodeBearingNode(node) &&
        ["implemented", "verified", "connected"].includes(node.status ?? "spec_only")
    ).length ?? 0;
  const verifiedNodeCount =
    graph?.nodes.filter((node) => isCodeBearingNode(node) && node.status === "verified").length ?? 0;
  const allCodeNodesVerified = codeBearingNodeCount > 0 && verifiedNodeCount === codeBearingNodeCount;
  const activeMascotScene = useMemo(() => {
    if (showGeneticPanel || tournamentResult) {
      return "genetic" as const;
    }

    if (showObservabilityPanel || heatmapData) {
      return "heatmap" as const;
    }

    if (showVcrPanel || vcrRecording) {
      return "vcr" as const;
    }

    if (showDigitalTwinPanel || digitalTwinSnapshot) {
      return "digitalTwin" as const;
    }

    if (showRefactorPanel || healResult) {
      return refactorReport && !refactorReport.isHealthy ? ("error" as const) : ("heal" as const);
    }

    if (ghostSuggestions.length > 0) {
      return "ghost" as const;
    }

    if (allCodeNodesVerified || exportResult) {
      return "polish" as const;
    }

    if (graph?.phase === "implementation") {
      return "implementation" as const;
    }

    return "spec" as const;
  }, [
    allCodeNodesVerified,
    digitalTwinSnapshot,
    exportResult,
    ghostSuggestions.length,
    graph?.phase,
    healResult,
    heatmapData,
    refactorReport,
    showDigitalTwinPanel,
    showGeneticPanel,
    showObservabilityPanel,
    showRefactorPanel,
    showVcrPanel,
    tournamentResult,
    vcrRecording
  ]);
  const canStartImplementation = graph ? canEnterImplementationPhase(graph) : false;
  const canStartIntegration = graph ? canEnterIntegrationPhase(graph) : false;
  const canImplementActiveNode = Boolean(activeCodeNode && graph?.phase === "implementation");
  const canRunActiveNode = Boolean(
    activeCodeNode &&
      graph?.phase === "implementation" &&
      ["implemented", "verified", "connected"].includes(activeCodeNode.status ?? "spec_only")
  );
  const canRunIntegration = Boolean(graph?.phase === "integration");
  const getNodeExecutionSteps = useCallback(
    (nodeId: string): ExecutionStep[] => executionIndex?.stepsByNodeId[nodeId] ?? [],
    [executionIndex]
  );
  const getNodeTestCases = useCallback(
    (nodeId: string) => executionIndex?.testCasesByNodeId[nodeId] ?? [],
    [executionIndex]
  );
  const getNodeTestResults = useCallback(
    (nodeId: string) => executionIndex?.testResultsByNodeId[nodeId] ?? [],
    [executionIndex]
  );
  const getArtifactsForStep = useCallback(
    (step: ExecutionStep): ExecutionArtifact[] =>
      (step.artifactIds ?? [])
        .map((artifactId) => executionIndex?.artifactsById[artifactId])
        .filter((artifact): artifact is ExecutionArtifact => Boolean(artifact)),
    [executionIndex]
  );
  const shouldShowPromptComposer = showPromptPanel || !graph;
  const toolbarStatusLabel = statusTitle;
  const toolbarStatusToneClass = `toolbar-status toolbar-status-${statusTone}`;
  const legacyFloatingPanelsEnabled = false;
  const closeToolbarMenus = () => setOpenToolbarMenu(null);
  const runToolbarAction = (action: () => void) => {
    closeToolbarMenus();
    action();
  };
  const pushActivity = useCallback(
    (source: string, message: string, tone: ActivityEntryTone = "info", detail?: string) => {
      setActivityFeed((current) => {
        const entry: ActivityEntry = {
          id: `${Date.now()}-${current.length}`,
          source,
          message,
          tone,
          timestamp: new Date().toISOString(),
          detail
        };

        return [...current, entry].slice(-80);
      });
    },
    []
  );
  const refreshCodeRagStatus = useCallback(
    async (announce = false) => {
      try {
        const response = await fetch("/api/coderag");
        const body = (await response.json()) as CodeRagStatusResponse;
        const nextStatus = response.ok ? body.status ?? "error" : "error";
        const nextMessage = body.message ?? body.error ?? "Failed to load CodeRAG status.";

        setCodeRagStatus(nextStatus);
        setCodeRagMessage(nextMessage);
        if (nextStatus !== "ready") {
          setCodeRagResult(null);
        }
        setCodeRagError(null);

        if (announce) {
          pushActivity("CodeRAG", nextMessage, nextStatus === "ready" ? "success" : "info");
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load CodeRAG status.";
        setCodeRagStatus("error");
        setCodeRagMessage(message);
        setCodeRagError(message);

        if (announce) {
          pushActivity("CodeRAG", message, "error");
        }
      }
    },
    [pushActivity]
  );
  const apiKeyStatus = nvidiaApiKey.trim()
    ? `Browser session key active (${maskApiKey(nvidiaApiKey)}).`
    : serverApiKeyConfigured
      ? "Server environment key detected."
      : apiKeyStatusLoaded
        ? "No NVIDIA API key detected yet."
        : "Checking for a server-side NVIDIA API key...";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Delete" || event.key === "Backspace") && !drilldownNodeId && graph && selectedNodeId) {
        setGraph(deleteNodeFromGraph(graph, selectedNodeId));
        setSelectedNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drilldownNodeId, graph, selectedNodeId, setGraph, setSelectedNodeId]);

  useEffect(() => {
    if (!openToolbarMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (toolbarRef.current && target instanceof Node && !toolbarRef.current.contains(target)) {
        setOpenToolbarMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openToolbarMenu]);

  useEffect(() => {
    const storedApiKey = loadSessionApiKey();
    if (storedApiKey) {
      setNvidiaApiKey(storedApiKey);
    }

    const storedCompletionPreference = readLocalBooleanPreference(LIVE_COMPLETIONS_STORAGE_KEY);
    if (storedCompletionPreference !== null) {
      setLiveCompletionsEnabled(storedCompletionPreference);
    }

    const storedAutoImplement = readLocalBooleanPreference(AUTO_IMPLEMENT_STORAGE_KEY);
    if (storedAutoImplement !== null) {
      setAutoImplementNodes(storedAutoImplement);
    }
  }, []);

  useEffect(() => {
    const storedRepoPath = readRepoPath();
    if (storedRepoPath) {
      setRepoPath(storedRepoPath);
    }

    const storedFloatingGraph = readFloatingGraph();
    if (storedFloatingGraph) {
      setFloatingGraph(storedFloatingGraph);
    }
  }, [setFloatingGraph, setRepoPath]);

  useEffect(() => {
    writeRepoPath(repoPath?.trim() ? repoPath : null);
  }, [repoPath]);

  useEffect(() => {
    writeFloatingGraph({
      x: floatingGraph.x,
      y: floatingGraph.y,
      width: floatingGraph.width,
      height: floatingGraph.height
    });
  }, [floatingGraph.height, floatingGraph.width, floatingGraph.x, floatingGraph.y]);

  useEffect(() => {
    if (!activeFile) {
      setEditorRevealTarget(null);
    }
  }, [activeFile]);

  useEffect(() => {
    pushActivity(
      "CodeFlow",
      "IDE shell ready.",
      "info",
      "Explorer, graph, editor, dock, and agent rail are live."
    );
  }, [pushActivity]);

  useEffect(() => {
    void refreshCodeRagStatus();
  }, [refreshCodeRagStatus]);

  useEffect(() => {
    setShowObservabilityPanel(activeDockTab === "heatmap");
    setShowVcrPanel(activeDockTab === "vcr");
    setShowDigitalTwinPanel(activeDockTab === "traces");
    setShowRefactorPanel(activeDockTab === "problems");
  }, [activeDockTab]);

  useEffect(() => {
    let ignore = false;

    const loadApiKeyStatus = async () => {
      try {
        const response = await fetch("/api/generate-blueprint");
        const body = (await response.json()) as BuildStatusProbeResponse;
        if (!ignore && response.ok) {
          setServerApiKeyConfigured(Boolean(body.serverApiKeyConfigured));
        }
      } catch (caughtError) {
        console.warn("[CodeFlow] Failed to probe NVIDIA API key status", caughtError);
      } finally {
        if (!ignore) {
          setApiKeyStatusLoaded(true);
        }
      }
    };

    void loadApiKeyStatus();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    storeSessionApiKey(nvidiaApiKey);
  }, [nvidiaApiKey]);

  useEffect(() => {
    writeLocalBooleanPreference(LIVE_COMPLETIONS_STORAGE_KEY, liveCompletionsEnabled);
  }, [liveCompletionsEnabled]);

  useEffect(() => {
    writeLocalBooleanPreference(AUTO_IMPLEMENT_STORAGE_KEY, autoImplementNodes);
  }, [autoImplementNodes]);

  useEffect(() => {
    if (!isBuilding) {
      return;
    }

    const messages = useAI
      ? [
          "Sending your prompt to NVIDIA.",
          "Waiting for the executionModel response. This can take a bit for larger prompts.",
          "Validating the returned blueprint structure.",
          "Preparing the graph for the workbench."
        ]
      : [
          "Parsing the PRD input.",
          "Scanning the repo for JavaScript and TypeScript source files.",
          "Merging nodes, edges, and workflow steps.",
          "Preparing the graph for the workbench."
        ];

    let index = 0;
    setStatusDetail(messages[index]);

    const intervalId = window.setInterval(() => {
      index = (index + 1) % messages.length;
      setStatusDetail(messages[index]);
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [isBuilding, useAI]);

  useEffect(() => {
    if (!graph || !activeCodeNode) {
      return;
    }

    const generatedCode =
      activeCodeNode.implementationDraft ?? activeCodeNode.specDraft ?? generateNodeCode(activeCodeNode, graph);
    if (!generatedCode) {
      return;
    }

    setCodeDrafts((current) =>
      current[activeCodeNode.id] ? current : { ...current, [activeCodeNode.id]: generatedCode }
    );
  }, [graph, activeCodeNode]);

  useEffect(() => {
    setCodeSuggestion(null);
    setSuggestionInstruction("");
  }, [activeCodeNode?.id]);

  // ── VCR effects ────────────────────────────────────────────────────────
  // Recompute the replay graph every time the frame index changes.
  useEffect(() => {
    if (!graph || !vcrRecording || vcrRecording.frames.length === 0) {
      setVcrGraph(null);
      return;
    }

    setVcrGraph(replayAtFrame(graph, vcrRecording, vcrFrameIndex));
  }, [graph, vcrRecording, vcrFrameIndex]);

  // Auto-advance the frame index while VCR is playing.
  useEffect(() => {
    if (!vcrPlaying || !vcrRecording || vcrRecording.frames.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setVcrFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= vcrRecording.frames.length) {
          setVcrPlaying(false);
          return prev;
        }
        return next;
      });
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [vcrPlaying, vcrRecording]);

  // Clear the full refactor report when the graph is replaced by an external
  // action (new build, branch switch, etc.) so stale drift highlighting doesn't
  // linger.  Skip when the graph was just replaced by a heal operation — the
  // heal handler sets a fresh post-heal report in the same render batch.
  useEffect(() => {
    if (graphReplacedByHealRef.current) {
      graphReplacedByHealRef.current = false;
      return;
    }
    setRefactorReport(null);
    setHealResult(null);
  }, [graph]);

  const pollObservability = useCallback(async () => {
    if (!projectName.trim() || !autoObsRef.current) {
      return;
    }

    try {
      const response = await fetch(
        `/api/observability/latest?projectName=${encodeURIComponent(projectName.trim())}`
      );
      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as ObservabilityLatestResponse;
      if (body.graph) {
        setGraph(body.graph);
      }

      setLatestSpans(body.latestSpans ?? []);
      setLatestLogs(body.latestLogs ?? []);
      setObservabilityPollError(null);
      setObservabilityLastUpdatedAt(new Date().toISOString());
    } catch (caughtError) {
      setObservabilityPollError(
        caughtError instanceof Error ? caughtError.message : "Observability polling failed."
      );
    }
  }, [projectName, setGraph]);

  useEffect(() => {
    if (!autoObservability) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollObservability();
    }, Math.max(MIN_OBSERVABILITY_INTERVAL_SECS, observabilityIntervalSecs) * 1000);

    return () => window.clearInterval(intervalId);
  }, [autoObservability, observabilityIntervalSecs, pollObservability]);

  // ── Digital Twin auto-poll ────────────────────────────────────────────────
  const pollDigitalTwin = useCallback(async () => {
    if (!projectName.trim() || !autoDigitalTwinRef.current) {
      return;
    }

    try {
      const response = await fetch(
        `/api/digital-twin?projectName=${encodeURIComponent(projectName.trim())}&activeWindowSecs=${digitalTwinWindowSecs}`
      );
      if (!response.ok) return;

      const body = (await response.json()) as DigitalTwinResponse;
      setDigitalTwinSnapshot(body.snapshot ?? null);
      if (body.graph) {
        setDigitalTwinGraph(body.graph);
        setGraph(body.graph);
      }
      setDigitalTwinPollError(null);
      setDigitalTwinLastUpdatedAt(body.snapshot?.computedAt ?? new Date().toISOString());
    } catch (caughtError) {
      setDigitalTwinPollError(
        caughtError instanceof Error ? caughtError.message : "Digital Twin polling failed."
      );
    }
  }, [digitalTwinWindowSecs, projectName, setGraph]);

  useEffect(() => {
    if (!autoDigitalTwin || !showDigitalTwinPanel) return;

    const intervalId = window.setInterval(() => {
      void pollDigitalTwin();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [autoDigitalTwin, pollDigitalTwin, showDigitalTwinPanel]);

  const handleLoadDigitalTwin = useCallback(async () => {
    if (!projectName.trim()) return;
    setBusyLabel("Loading digital twin");
    setDigitalTwinError(null);
    setActiveDockTab("traces");
    pushActivity("Traces", "Refreshing Digital Twin.", "command");

    try {
      const response = await fetch(
        `/api/digital-twin?projectName=${encodeURIComponent(projectName.trim())}&activeWindowSecs=${digitalTwinWindowSecs}`
      );
      const body = (await response.json()) as DigitalTwinResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load digital twin snapshot.");
      }

      setDigitalTwinSnapshot(body.snapshot ?? null);
      if (body.graph) {
        setDigitalTwinGraph(body.graph);
        setGraph(body.graph);
      }
      setDigitalTwinPollError(null);
      setDigitalTwinLastUpdatedAt(body.snapshot?.computedAt ?? new Date().toISOString());
      pushActivity("Traces", "Digital Twin refreshed.", "success");
    } catch (caughtError) {
      pushActivity(
        "Traces",
        caughtError instanceof Error ? caughtError.message : "Failed to load digital twin.",
        "error"
      );
      setDigitalTwinError(
        caughtError instanceof Error ? caughtError.message : "Failed to load digital twin."
      );
    } finally {
      setBusyLabel(null);
    }
  }, [digitalTwinWindowSecs, projectName, pushActivity, setActiveDockTab, setGraph]);

  const handleSimulateAction = useCallback(async () => {
    if (!projectName.trim() || !simulateNodeIds.trim()) return;
    setBusyLabel("Simulating user action");
    setDigitalTwinError(null);
    setActiveDockTab("traces");
    pushActivity("Traces", "Running Digital Twin simulation.", "command");

    try {
      const nodeIds = simulateNodeIds
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const response = await fetch("/api/digital-twin/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          nodeIds,
          label: simulateLabel.trim() || undefined
        })
      });
      const body = (await response.json()) as SimulateActionResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to simulate user action.");
      }

      // Refresh the digital twin view after the simulation.
      await handleLoadDigitalTwin();
    } catch (caughtError) {
      pushActivity(
        "Traces",
        caughtError instanceof Error ? caughtError.message : "Failed to simulate user action.",
        "error"
      );
      setDigitalTwinError(
        caughtError instanceof Error ? caughtError.message : "Failed to simulate user action."
      );
    } finally {
      setBusyLabel(null);
    }
  }, [handleLoadDigitalTwin, projectName, pushActivity, setActiveDockTab, simulateLabel, simulateNodeIds]);

  const handleDetectDrift = useCallback(async () => {
    if (!graph) return;
    // Abort any previous in-flight request.
    refactorAbortRef.current?.abort();
    const controller = new AbortController();
    refactorAbortRef.current = controller;

    setBusyLabel("Detecting drift");
    setRefactorError(null);
    setHealResult(null);
    setActiveDockTab("problems");
    pushActivity("Problems", "Detecting architectural drift.", "command");

    try {
      const response = await fetch("/api/refactor/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph),
        signal: controller.signal
      });
      const body = (await response.json()) as RefactorDetectResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to detect architectural drift.");
      }

      setRefactorReport(body.report ?? null);
      if (body.report) {
        pushActivity(
          "Problems",
          body.report.isHealthy
            ? "Architecture is healthy."
            : `${body.report.totalIssues} drift issues detected.`,
          body.report.isHealthy ? "success" : "error"
        );
      }
    } catch (caughtError) {
      if ((caughtError as { name?: string }).name === "AbortError") return;
      pushActivity(
        "Problems",
        caughtError instanceof Error ? caughtError.message : "Failed to detect drift.",
        "error"
      );
      setRefactorError(
        caughtError instanceof Error ? caughtError.message : "Failed to detect drift."
      );
    } finally {
      if (refactorAbortRef.current === controller) {
        refactorAbortRef.current = null;
      }
      setBusyLabel(null);
    }
  }, [graph, pushActivity, setActiveDockTab]);

  const handleHealArchitecture = useCallback(async () => {
    if (!graph) return;
    // Abort any previous in-flight request.
    refactorAbortRef.current?.abort();
    const controller = new AbortController();
    refactorAbortRef.current = controller;

    setBusyLabel("Healing architecture");
    setRefactorError(null);
    setActiveDockTab("problems");
    pushActivity("Problems", "Applying graph heal operations.", "command");

    try {
      const response = await fetch("/api/refactor/heal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graph),
        signal: controller.signal
      });
      const body = (await response.json()) as RefactorHealResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to heal architectural drift.");
      }

      if (body.result?.graph) {
        graphReplacedByHealRef.current = true;
        setGraph(body.result.graph);
      }
      setRefactorReport(body.report ?? null);
      setHealResult(body.result ?? null);

      setStatusTitle("Architecture healed");
      setStatusDetail(
        `Fixed ${body.result?.issuesFixed ?? 0} drift issue${(body.result?.issuesFixed ?? 0) !== 1 ? "s" : ""}.`
      );
      setStatusTone("success");
      pushActivity(
        "Problems",
        `Healed ${body.result?.issuesFixed ?? 0} drift issue${(body.result?.issuesFixed ?? 0) === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (caughtError) {
      if ((caughtError as { name?: string }).name === "AbortError") return;
      pushActivity(
        "Problems",
        caughtError instanceof Error ? caughtError.message : "Failed to heal architecture.",
        "error"
      );
      setRefactorError(
        caughtError instanceof Error ? caughtError.message : "Failed to heal architecture."
      );
    } finally {
      if (refactorAbortRef.current === controller) {
        refactorAbortRef.current = null;
      }
      setBusyLabel(null);
    }
  }, [graph, pushActivity, setGraph, setActiveDockTab]);

  // ── Genetic Evolution handler ─────────────────────────────────────────────
  const handleRunGeneticEvolution = useCallback(async () => {
    if (!graph) return;
    setBusyLabel("Running genetic evolution");
    setGeneticError(null);
    setTournamentResult(null);
    setStatusTitle("Running genetic evolution");
    setStatusDetail("Evolution in progress...");
    setStatusTone("info");
    try {
      const response = await fetch("/api/genetic/evolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          generations: geneticGenerations,
          populationSize: geneticPopulationSize
        })
      });
      const body = (await response.json()) as { result?: TournamentResult; error?: string };
      if (!response.ok || !body.result) {
        throw new Error(body.error ?? "Failed to run genetic evolution.");
      }
      setTournamentResult(body.result);
      setStatusTitle("Genetic evolution complete");
      setStatusDetail(body.result.summary);
      setStatusTone("success");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to run genetic evolution.";
      setGeneticError(message);
      setStatusTitle("Genetic evolution failed");
      setStatusDetail(message);
      setStatusTone("danger");
    } finally {
      setBusyLabel(null);
    }
  }, [graph, geneticGenerations, geneticPopulationSize]);

  const handleBuild = async () => {
    const buildStartedAt = performance.now();
    setActiveDockTab("terminal");
    pushActivity(
      useAI ? "NVIDIA" : "Blueprint",
      useAI ? "Starting AI blueprint build." : "Starting repo blueprint build.",
      "command"
    );
    setBusyLabel("Building blueprint");
    setError(null);
    setExecutionResult(null);
    setStatusTone("info");
    setStatusTitle(useAI ? "Building blueprint with NVIDIA" : "Building blueprint");
    setStatusDetail(useAI ? "Sending your prompt to NVIDIA." : "Parsing your PRD and repository input.");

    try {
      const endpoint = useAI ? "/api/generate-blueprint" : "/api/blueprint";
      const payload = useAI
        ? {
            projectName,
            prompt: aiPrompt.trim(),
            mode: executionMode,
            nvidiaApiKey: nvidiaApiKey.trim() || undefined
          }
        : {
            projectName,
            repoPath: repoPath?.trim() || undefined,
            prdText: prdText.trim() || undefined,
            mode: executionMode
          };

      if (useAI && !aiPrompt.trim()) {
        throw new Error("Please enter a prompt for AI generation.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as BuildResponse;

      if (!response.ok || !body.graph || !body.runPlan || !body.session) {
        throw new Error(body.error || "Failed to build blueprint.");
      }

      setGraph(body.graph ?? graph);
      setRunPlan(body.runPlan ?? null);
      setSession(body.session ?? null);
      setRiskReport(null);
      setPendingApproval(null);
      setConflictReport(null);
      setLatestLogs([]);
      setLatestSpans([]);
      setCodeDrafts({});
      setCodeSuggestion(null);
      setSuggestionInstruction("");
      setSelectedNodeId(body.graph.nodes[0]?.id ?? null);
      setDrilldownStack([]);
      setSelectedDetailNodeId(null);
      setShowInspector(false);
      setShowEditPanel(false);
      setShowPromptPanel(false);
      setExportResult(null);
      setGhostSuggestions([]);
      void refreshCodeRagStatus();
      pushActivity(
        useAI ? "NVIDIA" : "Blueprint",
        `Blueprint ready with ${body.graph.nodes.length} nodes and ${body.graph.edges.length} edges.`,
        "success"
      );
      setStatusTone("success");
      setStatusTitle("Blueprint ready");
      setStatusDetail(
        `Built ${body.graph.nodes.length} nodes, ${body.graph.edges.length} edges, and ${body.graph.workflows.length} workflows.`
      );
      console.info("[CodeFlow] Blueprint build completed", {
        source: useAI ? "ai" : "legacy",
        durationMs: Math.round(performance.now() - buildStartedAt)
      });
    } catch (caughtError) {
      const message = normalizeClientFetchError(
        caughtError,
        "Failed to build blueprint.",
        "build the blueprint"
      );
      pushActivity(useAI ? "NVIDIA" : "Blueprint", message, "error");
      setError(message);
      setStatusTone("danger");
      setStatusTitle("Blueprint build failed");
      setStatusDetail(message);
    } finally {
      setBusyLabel(null);
    }
  };

  const handleApplyTraces = async () => {
    if (!graph) {
      setError("Build a blueprint before applying traces.");
      return;
    }

    try {
      setActiveDockTab("traces");
      const spans = tracesSchema.parse(JSON.parse(traceInput));
      const nextGraph = applyTraceOverlay(graph, spans);
      setGraph(nextGraph);
      if (projectName.trim()) {
        const response = await fetch("/api/observability/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectName, spans, logs: [] })
        });

        if (response.ok) {
          const body = (await response.json()) as ObservabilityLatestResponse & {
            session?: PersistedSession;
          };
          setLatestSpans(body.latestSpans ?? []);
          setLatestLogs(body.latestLogs ?? []);
          setSession(body.session ?? null);
        }
      }

      setError(null);
      pushActivity("Traces", `Applied ${spans.length} trace span${spans.length === 1 ? "" : "s"} to the graph.`, "success");
    } catch (caughtError) {
      pushActivity(
        "Traces",
        caughtError instanceof Error ? caughtError.message : "Failed to apply traces.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to apply traces.");
    }
  };

  const handleExport = async (approvalId?: string) => {
    if (!graph) {
      setError("Build a blueprint before exporting artifacts.");
      return;
    }

    setBusyLabel("Exporting artifacts");
    setError(null);
    setActiveDockTab("terminal");
    pushActivity("Export", "Preparing artifact export.", "command");

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          outputDir: outputDir.trim() || undefined,
          approvalId,
          codeDrafts: Object.keys(codeDrafts).length ? codeDrafts : undefined
        })
      });
      const body = (await response.json()) as ExportResponse;

      if (!response.ok) {
        throw new Error(body.error || "Failed to export artifacts.");
      }

      if (body.requiresApproval && body.approval && body.riskReport && body.runPlan) {
        setPendingApproval(body.approval);
        setRiskReport(body.riskReport);
        setRunPlan(body.runPlan);
        setSession(body.session ?? null);
        setExportResult(null);
        return;
      }

      if (!body.result || !body.riskReport || !body.runPlan || !body.session) {
        throw new Error("Export response was incomplete.");
      }

      setPendingApproval(null);
      setRiskReport(body.riskReport);
      setRunPlan(body.runPlan);
      setSession(body.session);
      setExportResult(body.result);
      void refreshCodeRagStatus();
      pushActivity("Export", `Artifacts written to ${body.result.rootDir}.`, "success");
    } catch (caughtError) {
      pushActivity(
        "Export",
        caughtError instanceof Error ? caughtError.message : "Failed to export artifacts.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export artifacts.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleRunCodeRagQuery = useCallback(async () => {
    if (!codeRagQuery.trim()) {
      setCodeRagError("Enter a CodeRAG query.");
      return;
    }

    setCodeRagLoading(true);
    setCodeRagError(null);
    pushActivity("CodeRAG", `Querying \"${codeRagQuery.trim()}\".`, "command");

    try {
      const response = await fetch("/api/coderag", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: codeRagQuery.trim(),
          depth: codeRagDepth
        })
      });
      const body = (await response.json()) as CodeRagQueryResponse;

      if (!response.ok || !body.results) {
        throw new Error(body.error ?? "CodeRAG query failed.");
      }

      setCodeRagStatus("ready");
      setCodeRagMessage("CodeRAG context is ready and will be reused by the coding agent.");
      setCodeRagResult(body.results);
      pushActivity("CodeRAG", "Retrieval context updated.", "success");
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "CodeRAG query failed.";
      setCodeRagError(message);
      setCodeRagResult(null);
      pushActivity("CodeRAG", message, "error");
      void refreshCodeRagStatus();
    } finally {
      setCodeRagLoading(false);
    }
  }, [codeRagDepth, codeRagQuery, pushActivity, refreshCodeRagStatus]);

  const requestNodeImplementation = async (
    targetGraph: BlueprintGraph,
    nodeId: string,
    currentCode?: string
  ): Promise<ImplementNodeResponse> => {
    const response = await fetch("/api/implement-node", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        graph: targetGraph,
        nodeId,
        currentCode,
        retrievalQuery: codeRagQuery.trim() || undefined,
        retrievalDepth: codeRagDepth,
        nvidiaApiKey: nvidiaApiKey.trim() || undefined
      })
    });
    const body = (await response.json()) as ImplementNodeResponse;
    if (!response.ok || !body.graph || !body.implementation || !body.runPlan || !body.session) {
      throw new Error(body.error || `Failed to implement node ${nodeId}.`);
    }
    return body;
  };

  const implementRemainingNodes = async (targetGraph: BlueprintGraph) => {
    let workingGraph = targetGraph;
    const codeNodes = workingGraph.nodes.filter(isCodeBearingNode);

    for (const node of codeNodes) {
      if (node.implementationDraft && ["implemented", "verified", "connected"].includes(node.status ?? "spec_only")) {
        continue;
      }

      const currentCode =
        codeDrafts[node.id] ?? node.implementationDraft ?? node.specDraft ?? generateNodeCode(node, workingGraph) ?? "";
      const body = await requestNodeImplementation(workingGraph, node.id, currentCode);
      workingGraph = body.graph as BlueprintGraph;
      setGraph(workingGraph);
      setRunPlan(body.runPlan ?? null);
      setSession(body.session ?? null);
      setCodeDrafts((current) => ({
        ...current,
        [node.id]: body.implementation?.code ?? currentCode
      }));
    }

    setStatusTone("success");
    setStatusTitle("Phase 2 generated");
    setStatusDetail(`Implemented ${codeNodes.length} nodes one call at a time.`);
  };

  const handleAdvanceToImplementation = async () => {
    if (!graph || !canStartImplementation) {
      setError("Phase 1 is not complete yet.");
      return;
    }

    const nextGraph = setGraphPhase(graph, "implementation");
    setGraph(nextGraph);
    setStatusTone("success");
    setStatusTitle("Phase 2 unlocked");
    setStatusDetail("Specification artifacts are ready. Implement nodes one by one.");

    if (autoImplementNodes) {
      setBusyLabel("Auto-implementing nodes");
      try {
        await implementRemainingNodes(nextGraph);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Failed to auto-implement nodes.");
        setStatusTone("danger");
        setStatusTitle("Auto-implementation failed");
      } finally {
        setBusyLabel(null);
      }
    }
  };

  const handleAdvanceToIntegration = () => {
    if (!graph || !canStartIntegration) {
      setError("All code-bearing nodes must be verified before entering integration.");
      return;
    }

    const nextGraph = setGraphPhase(graph, "integration");
    setGraph(nextGraph);
    setStatusTone("success");
    setStatusTitle("Phase 3 unlocked");
    setStatusDetail("Integration is now enabled. Run the connected flow end to end.");
  };

  const handleImplementNode = async () => {
    if (!graph || !activeCodeNode) {
      setError("Select a code-bearing node before implementing.");
      return;
    }

    if (graph.phase !== "implementation") {
      setError("Enter Phase 2 before implementing nodes.");
      return;
    }

    setBusyLabel("Implementing node");
    setError(null);
    setActiveDockTab("terminal");
    pushActivity("Implementation", `Implementing ${activeCodeNode.name}.`, "command");

    try {
      const body = await requestNodeImplementation(graph, activeCodeNode.id, activeCodeDraft);

      setGraph(body.graph ?? graph);
      setRunPlan(body.runPlan ?? null);
      setSession(body.session ?? null);
      setCodeDrafts((current) => ({
        ...current,
        [activeCodeNode.id]: body.implementation?.code ?? activeCodeDraft
      }));
      setStatusTone("success");
      setStatusTitle("Node implemented");
      setStatusDetail(`Implemented ${activeCodeNode.name}. Run it before moving on.`);
      pushActivity("Implementation", `${activeCodeNode.name} implementation draft updated.`, "success");
    } catch (caughtError) {
      pushActivity(
        "Implementation",
        caughtError instanceof Error ? caughtError.message : "Failed to implement node.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to implement node.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleRunExecution = async () => {
    if (!graph) {
      setError("Build a blueprint before executing.");
      return;
    }

    const targetNodeId = graph.phase === "integration" ? undefined : activeCodeNode?.id;
    if (graph.phase === "spec") {
      setError("Complete Phase 1 and move into Phase 2 before running code.");
      return;
    }

    if (graph.phase === "implementation" && !targetNodeId) {
      setError("Select an implemented node to run in Phase 2.");
      return;
    }

    setBusyLabel(graph.phase === "integration" ? "Running integration" : "Running node");
    setError(null);
    setActiveDockTab("terminal");
    pushActivity(
      "Runtime",
      graph.phase === "integration"
        ? "Running integration flow."
        : `Running ${activeCodeNode?.name ?? "selected node"}.`,
      "command"
    );

    try {
      const response = await fetch("/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          targetNodeId,
          input: runInput,
          codeDrafts: Object.keys(codeDrafts).length ? codeDrafts : undefined,
          includeGeneratedTests: true
        })
      });
      const body = (await response.json()) as ExecutionResponse;

      if (!response.ok || !body.result || !body.graph || !body.runPlan || !body.session) {
        throw new Error(body.error || "Failed to execute.");
      }

      setExecutionResult(body.result);
      setGraph(body.graph);
      setRunPlan(body.runPlan);
      setSession(body.session);

      if (body.result.success) {
        setStatusTone("success");
        setStatusTitle(graph.phase === "integration" ? "Integration succeeded" : "Node verified");
        setStatusDetail(
          [
            `Exit code ${body.result.exitCode ?? 0} in ${body.result.durationMs}ms.`,
            body.result.summary
              ? `${body.result.summary.passed} passed · ${body.result.summary.warning} warning · ${body.result.summary.failed} failed · ${body.result.summary.blocked} blocked`
              : null,
            body.result.testResults.length
              ? `${body.result.testResults.length} generated test result${body.result.testResults.length === 1 ? "" : "s"} recorded.`
              : null
          ]
            .filter(Boolean)
            .join(" ")
        );
      } else {
        pushActivity(
          "Runtime",
          body.result.steps.find((step) => step.status === "failed" || step.status === "blocked")?.message ??
            (body.result.stderr || body.result.error || "Execution failed."),
          "error"
        );
        setStatusTone("danger");
        setStatusTitle("Execution failed");
        setStatusDetail(
          body.result.steps.find((step) => step.status === "failed" || step.status === "blocked")?.message ??
            (body.result.stderr || body.result.error || "Unknown execution failure.")
        );
      }
      if (body.result.success) {
        pushActivity(
          "Runtime",
          body.result.summary
            ? `${body.result.summary.passed} passed, ${body.result.summary.failed} failed, ${body.result.summary.blocked} blocked.`
            : "Execution succeeded.",
          "success"
        );
      }
    } catch (caughtError) {
      pushActivity(
        "Runtime",
        caughtError instanceof Error ? caughtError.message : "Failed to execute.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to execute.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleLoadObservability = async () => {
    if (!projectName.trim()) {
      setError("Project name is required to load observability.");
      return;
    }

    setBusyLabel("Loading observability");
    setError(null);
    setActiveDockTab("heatmap");
    pushActivity("Observability", "Refreshing observability data.", "command");

    try {
      const response = await fetch(
        `/api/observability/latest?projectName=${encodeURIComponent(projectName.trim())}`
      );
      const body = (await response.json()) as ObservabilityLatestResponse;

      if (!response.ok) {
        throw new Error(body.error || "Failed to load observability.");
      }

      if (body.graph) {
        setGraph(body.graph);
      }

      setLatestSpans(body.latestSpans ?? []);
      setLatestLogs(body.latestLogs ?? []);
      setObservabilityPollError(null);
      setObservabilityLastUpdatedAt(new Date().toISOString());
      pushActivity("Observability", "Observability data refreshed.", "success");
    } catch (caughtError) {
      pushActivity(
        "Observability",
        caughtError instanceof Error ? caughtError.message : "Failed to load observability.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load observability.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleAnalyzeConflicts = async () => {
    if (!graph || !repoPath?.trim()) {
      setError("Build a blueprint and provide a repo path before analyzing conflicts.");
      return;
    }

    setBusyLabel("Analyzing conflicts");
    setError(null);
    setActiveDockTab("problems");
    pushActivity("Problems", "Analyzing graph drift against the repo.", "command");

    try {
      const response = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          repoPath: repoPath?.trim()
        })
      });
      const body = (await response.json()) as ConflictResponse;

      if (!response.ok || !body.report) {
        throw new Error(body.error || "Failed to analyze conflicts.");
      }

      setConflictReport(body.report);
      pushActivity("Problems", `${body.report.conflicts.length} drift conflicts reported.`, "success");
    } catch (caughtError) {
      pushActivity(
        "Problems",
        caughtError instanceof Error ? caughtError.message : "Failed to analyze conflicts.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Failed to analyze conflicts.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleAddNode = () => {
    if (!graph || !newNodeName.trim()) {
      setError("Build a blueprint and enter a node name before adding a node.");
      return;
    }

    const nextGraph = addNodeToGraph(graph, {
      kind: newNodeKind,
      name: newNodeName.trim()
    });
    setGraph(nextGraph);
    setSelectedNodeId(nextGraph.nodes[nextGraph.nodes.length - 1]?.id ?? null);
    setNewNodeName("");
    setError(null);
  };

  const handleAddEdge = () => {
    if (!graph || !edgeFrom || !edgeTo) {
      setError("Select both edge endpoints before adding an edge.");
      return;
    }

    setGraph(addEdgeToGraph(graph, { from: edgeFrom, to: edgeTo, kind: edgeKind }));
    setError(null);
  };

  const handleApproveAndExport = async () => {
    if (!pendingApproval) {
      setError("There is no pending approval to apply.");
      return;
    }

    setBusyLabel("Approving export");
    setError(null);

    try {
      const response = await fetch("/api/approvals/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approvalId: pendingApproval.id })
      });
      const body = (await response.json()) as { approval?: ApprovalRecord; error?: string };

      if (!response.ok || !body.approval) {
        throw new Error(body.error || "Failed to approve export.");
      }

      setPendingApproval(body.approval);
      await handleExport(body.approval.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to approve export.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleOpenFile = useCallback(
    (filePath: string, revealTarget: ReturnType<typeof getNavigationTarget> = null) => {
      const nextOpenFiles = openFiles.includes(filePath) ? openFiles : [...openFiles, filePath];
      setOpenFiles(nextOpenFiles);
      setActiveFile(filePath);
      setEditorRevealTarget(revealTarget);
      setNavigationError(null);
      setActiveDockTab("terminal");
      pushActivity("Explorer", `Opened ${filePath}.`, "info");
    },
    [openFiles, pushActivity, setActiveFile, setOpenFiles]
  );

  const handleOpenNodeSource = useCallback(
    (nodeId: string) => {
      if (!graph) {
        return;
      }

      const node = graph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        return;
      }

      const navigationTarget = getNavigationTarget(node);
      if (!isValidNavigationTarget(navigationTarget)) {
        setEditorRevealTarget(null);
        setNavigationError(`Missing source navigation metadata for ${node.name}.`);
        pushActivity("Navigation", `Missing source metadata for ${node.name}.`, "error");
        return;
      }

      handleOpenFile(navigationTarget.filePath, navigationTarget);
    },
    [graph, handleOpenFile, pushActivity]
  );

  const handleGraphSelect = (nodeId: string) => {
    if (drilldownRootNode) {
      setSelectedDetailNodeId(nodeId);
      return;
    }

    setSelectedNodeId(nodeId);
    setNavigationError(null);
    if (activeFile) {
      handleOpenNodeSource(nodeId);
    }
  };

  const handleGraphDoubleClick = (nodeId: string) => {
    if (!graph) {
      return;
    }

    if (!drilldownRootNode) {
      const nextDetailFlow = buildDetailFlow(graph, nodeId);
      if (!nextDetailFlow) {
        return;
      }

      setSelectedNodeId(nodeId);
      setDrilldownStack([nodeId]);
      setSelectedDetailNodeId(nextDetailFlow.items[0]?.id ?? null);
      return;
    }

    const clickedItem = detailFlow?.items.find((item) => item.id === nodeId);
    if (!clickedItem?.drilldownNodeId) {
      return;
    }

    const nextDetailFlow = buildDetailFlow(graph, clickedItem.drilldownNodeId);
    if (!nextDetailFlow) {
      return;
    }

    setSelectedNodeId(clickedItem.drilldownNodeId);
    setDrilldownStack((current) => [...current, clickedItem.drilldownNodeId as string]);
    setSelectedDetailNodeId(nextDetailFlow.items[0]?.id ?? null);
  };

  const handleDrilldownBack = () => {
    if (!drilldownStack.length) {
      return;
    }

    const nextStack = drilldownStack.slice(0, -1);
    const nextNodeId = nextStack.at(-1) ?? null;
    setDrilldownStack(nextStack);
    setSelectedNodeId(nextNodeId);

    if (!graph || !nextNodeId) {
      setSelectedDetailNodeId(null);
      return;
    }

    const nextDetailFlow = buildDetailFlow(graph, nextNodeId);
    setSelectedDetailNodeId(nextDetailFlow?.items[0]?.id ?? null);
  };

  const handleSuggestCode = async () => {
    if (!graph || !activeCodeNode) {
      setError("Select a code-bearing node before requesting a suggestion.");
      return;
    }

    setBusyLabel("Generating code suggestion");
    setError(null);

    try {
      const response = await fetch("/api/code-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          nodeId: activeCodeNode.id,
          currentCode: activeCodeDraft,
          instruction: suggestionInstruction.trim() || undefined,
          retrievalQuery: codeRagQuery.trim() || undefined,
          retrievalDepth: codeRagDepth,
          nvidiaApiKey: nvidiaApiKey.trim() || undefined
        })
      });
      const body = (await response.json()) as CodeSuggestionResponse & { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Failed to generate a code suggestion.");
      }

      setCodeSuggestion({
        summary: body.summary,
        code: body.code,
        notes: body.notes ?? []
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to generate a code suggestion.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleRunAnalysis = async () => {
    if (!graph) {
      setError("Build a blueprint before running analysis.");
      return;
    }

    setBusyLabel("Analyzing architecture");
    setError(null);
    setActiveDockTab("problems");
    pushActivity("Problems", "Running architecture analysis.", "command");
    // Clear stale results from any prior run so the panel always reflects the
    // current analysis and not leftover data from a failed/partial run.
    setCycleReport(null);
    setSmellReport(null);
    setGraphMetrics(null);
    setMermaidDiagram(null);
    const guardedJson = async <T,>(r: Response): Promise<T> => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        const apiError = (body as { error?: string }).error;
        throw new Error(apiError ?? `${r.status} ${r.statusText}`.trim());
      }
      return r.json() as Promise<T>;
    };

    try {
      const [cyclesResult, smellsResult, metricsResult, mermaidResult] = await Promise.allSettled([
        fetch("/api/analysis/cycles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(graph)
        }).then((r) => guardedJson<CyclesResponse>(r)),
        fetch("/api/analysis/smells", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(graph)
        }).then((r) => guardedJson<SmellsResponse>(r)),
        fetch("/api/analysis/metrics", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(graph)
        }).then((r) => guardedJson<MetricsResponse>(r)),
        fetch("/api/export/mermaid", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ graph, format: "flowchart" })
        }).then((r) => guardedJson<MermaidResponse>(r))
      ]);

      if (cyclesResult.status === "fulfilled" && cyclesResult.value.report) setCycleReport(cyclesResult.value.report);
      if (smellsResult.status === "fulfilled" && smellsResult.value.report) setSmellReport(smellsResult.value.report);
      if (metricsResult.status === "fulfilled" && metricsResult.value.metrics) setGraphMetrics(metricsResult.value.metrics);
      if (mermaidResult.status === "fulfilled" && mermaidResult.value.diagram) setMermaidDiagram(mermaidResult.value.diagram);

      const smellsReport = smellsResult.status === "fulfilled" ? smellsResult.value.report : null;
      const cyclesReport = cyclesResult.status === "fulfilled" ? cyclesResult.value.report : null;

      setStatusTitle("Analysis complete");
      setStatusDetail(
        `${smellsReport?.totalSmells ?? 0} smells · ${cyclesReport?.totalCycles ?? 0} cycles · Health ${smellsReport?.healthScore ?? 100}/100`
      );
      setStatusTone("success");
      pushActivity(
        "Problems",
        `${smellsReport?.totalSmells ?? 0} smells and ${cyclesReport?.totalCycles ?? 0} cycles detected.`,
        "success"
      );
    } catch (caughtError) {
      pushActivity(
        "Problems",
        caughtError instanceof Error ? caughtError.message : "Architecture analysis failed.",
        "error"
      );
      setError(caughtError instanceof Error ? caughtError.message : "Architecture analysis failed.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleLoadBranches = async () => {
    if (!graph) return;
    try {
      const response = await fetch(
        `/api/branches?projectName=${encodeURIComponent(graph.projectName)}`
      );
      const body = (await response.json()) as BranchListResponse;
      if (response.ok && body.branches) {
        setBranches(body.branches);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load branches.");
    }
  };

  const handleCreateBranch = async () => {
    if (!graph) {
      setError("Build a blueprint before creating a branch.");
      return;
    }
    if (!newBranchName.trim()) {
      setError("Branch name is required.");
      return;
    }

    setBusyLabel("Creating branch");
    setError(null);

    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          name: newBranchName.trim(),
          description: newBranchDescription.trim() || undefined,
          parentBranchId: activeBranchId ?? undefined
        })
      });
      const body = (await response.json()) as BranchCreateResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to create branch.");
      }

      if (body.branch) {
        setBranches([...branches, body.branch]);
        setActiveBranchId(body.branch.id);
        setNewBranchName("");
        setNewBranchDescription("");
        setStatusTitle("Branch created");
        setStatusDetail(`"${body.branch.name}" branch saved as a snapshot of the current graph.`);
        setStatusTone("success");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create branch.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleSuggestGhostNodes = async () => {
    if (!graph) {
      setError("Build a blueprint before requesting ghost node suggestions.");
      return;
    }

    setBusyLabel("Suggesting ghost nodes");
    setError(null);

    try {
      const response = await fetch("/api/ghost-nodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          nvidiaApiKey: nvidiaApiKey.trim() || undefined
        })
      });
      const body = (await response.json()) as GhostSuggestionsApiResponse;

      if (!response.ok) {
        throw new Error(body.error || "Failed to generate ghost node suggestions.");
      }

      setGhostSuggestions(body.suggestions ?? []);
      if (body.suggestions?.length) {
        const provenance = body.suggestions[0].provenance;
        setStatusTone("info");
        setStatusTitle("Ghost suggestions ready");
        setStatusDetail(
          `${body.suggestions.length} ${provenance} ${provenance === "ai" ? "AI-assisted" : "heuristic"} suggestion${body.suggestions.length === 1 ? "" : "s"} added to the graph as preview nodes.`
        );
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to generate ghost node suggestions.");
    } finally {
      setBusyLabel(null);
    }
  };

  const parseMcpHeaders = (): Record<string, string> | undefined => {
    const raw = mcpHeadersJson.trim();
    if (!raw) {
      return undefined;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("MCP headers must be valid JSON.");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("MCP headers must be a JSON object whose values are strings.");
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "string") {
        throw new Error(`MCP header "${key}" must have a string value.`);
      }
      result[key] = value;
    }

    return Object.keys(result).length ? result : undefined;
  };

  const parseMcpArgs = (): Record<string, unknown> => {
    try {
      return JSON.parse(mcpToolArgsJson.trim() || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const handleListMcpTools = async () => {
    if (!mcpServerUrl.trim()) {
      setMcpError("Enter an MCP server URL first.");
      return;
    }

    let headersConfig: Record<string, string> | undefined;
    try {
      headersConfig = parseMcpHeaders();
    } catch (parseError) {
      setMcpError(parseError instanceof Error ? parseError.message : "Invalid MCP headers.");
      return;
    }

    setBusyLabel("Listing MCP tools");
    setMcpError(null);
    setAvailableMcpTools([]);
    setMcpInvokeResult(null);

    try {
      const response = await fetch("/api/mcp/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverUrl: mcpServerUrl.trim(), headers: headersConfig })
      });
      const body = (await response.json()) as McpToolsResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to list MCP tools.");
      }

      setAvailableMcpTools(body.tools ?? []);
      if (body.tools?.length) {
        setMcpToolName(body.tools[0]?.name ?? "");
      }
    } catch (caughtError) {
      setMcpError(caughtError instanceof Error ? caughtError.message : "Failed to list MCP tools.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleInvokeMcpTool = async () => {
    if (!mcpServerUrl.trim() || !mcpToolName.trim()) {
      setMcpError("Enter a server URL and tool name.");
      return;
    }

    setBusyLabel("Invoking MCP tool");
    setMcpError(null);
    setMcpInvokeResult(null);

    try {
      const response = await fetch("/api/mcp/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serverUrl: mcpServerUrl.trim(),
          toolName: mcpToolName.trim(),
          args: parseMcpArgs(),
          headers: parseMcpHeaders()
        })
      });
      const body = (await response.json()) as McpInvokeResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to invoke MCP tool.");
      }

      const content = body.result?.content ?? [];
      const textItems = content
        .filter((item) => item.type === "text" && item.text)
        .map((item) => item.text as string);
      const text = textItems.length > 0 ? textItems.join("\n") : "(empty result)";

      setMcpInvokeResult(body.result?.isError ? `Error: ${text}` : text);
    } catch (caughtError) {
      setMcpError(caughtError instanceof Error ? caughtError.message : "Failed to invoke MCP tool.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleSaveMcpServerToNode = () => {
    if (!graph || !selectedNodeId || !mcpServerUrl.trim()) {
      return;
    }

    const headers = parseMcpHeaders();
    const newServer: McpServerConfig = {
      serverUrl: mcpServerUrl.trim(),
      label: mcpServerUrl.trim(),
      ...(headers ? { headers } : {})
    };

    setGraph(
      updateNode(graph, selectedNodeId, (node) => ({
        ...node,
        mcpServers: [
          ...(node.mcpServers ?? []).filter((s) => s.serverUrl !== newServer.serverUrl),
          newServer
        ]
      }))
    );
  };

  const handleRemoveMcpServerFromNode = (serverUrl: string) => {
    if (!graph || !selectedNodeId) {
      return;
    }

    setGraph(
      updateNode(graph, selectedNodeId, (node) => ({
        ...node,
        mcpServers: (node.mcpServers ?? []).filter((s) => s.serverUrl !== serverUrl)
      }))
    );
  };

  // ── VCR handler ────────────────────────────────────────────────────────
  const handleLoadVcrRecording = async () => {
    if (!graph) {
      setVcrError("Build a blueprint before loading a VCR recording.");
      return;
    }

    setBusyLabel("Loading VCR recording");
    setVcrError(null);
    setVcrRecording(null);
    setVcrFrameIndex(0);
    setVcrPlaying(false);
    setActiveDockTab("vcr");
    pushActivity("VCR", "Loading replay frames from observability data.", "command");

    try {
      const response = await fetch(
        `/api/vcr?projectName=${encodeURIComponent(projectName.trim())}`
      );
      const body = (await response.json()) as VcrResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load VCR recording.");
      }

      if (body.recording) {
        setVcrRecording(body.recording);
        setVcrFrameIndex(0);
        setStatusTitle("VCR recording loaded");
        setStatusDetail(
          `${body.recording.totalSpans} span${body.recording.totalSpans === 1 ? "" : "s"} across ${body.recording.frames.length} frame${body.recording.frames.length === 1 ? "" : "s"}. Use the scrub bar to replay.`
        );
        setStatusTone("success");
        pushActivity("VCR", `Loaded ${body.recording.frames.length} replay frames.`, "success");
      }
    } catch (caughtError) {
      pushActivity(
        "VCR",
        caughtError instanceof Error ? caughtError.message : "Failed to load VCR recording.",
        "error"
      );
      setVcrError(caughtError instanceof Error ? caughtError.message : "Failed to load VCR recording.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleSolidifyGhostNode = (ghost: GhostNode) => {
    if (!graph) {
      return;
    }

    let nextGraph = graph;
    let targetNodeId: string | null = null;

    const existingNode = graph.nodes.find(
      (n) => n.kind === ghost.kind && n.name === ghost.name
    );

    if (existingNode) {
      targetNodeId = existingNode.id;
    } else {
      nextGraph = addNodeToGraph(graph, {
        kind: ghost.kind,
        name: ghost.name,
        summary: ghost.summary
      });

      const createdNode = nextGraph.nodes.find(
        (n) => n.kind === ghost.kind && n.name === ghost.name
      );
      targetNodeId = createdNode ? createdNode.id : null;
    }

    const suggestedEdge = ghost.suggestedEdge;
    if (suggestedEdge) {
      const fromExists = nextGraph.nodes.some((n) => n.id === suggestedEdge.from);
      if (fromExists && targetNodeId) {
        nextGraph = addEdgeToGraph(nextGraph, {
          from: suggestedEdge.from,
          to: targetNodeId,
          kind: suggestedEdge.kind
        });
      }
    }

    setGraph(nextGraph);
    setGhostSuggestions((current) => current.filter((g) => g.id !== ghost.id));
    setSelectedNodeId(targetNodeId);
  };
  const handleSwitchToBranch = (branch: GraphBranch) => {
    setGraph(branch.graph);
    setActiveBranchId(branch.id);
    setBranchDiff(null);
    setDiffTargetBranchId(null);
    setStatusTitle(`Switched to branch "${branch.name}"`);
    setStatusDetail("The graph has been replaced with the branch snapshot.");
    setStatusTone("info");
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!graph) return;

    try {
      const response = await fetch(
        `/api/branches/${branchId}?projectName=${encodeURIComponent(graph.projectName)}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setBranches((current) => current.filter((b) => b.id !== branchId));
        if (activeBranchId === branchId) {
          setActiveBranchId(null);
        }
        if (diffTargetBranchId === branchId) {
          setBranchDiff(null);
          setDiffTargetBranchId(null);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to delete branch.");
    }
  };

  const handleDiffBranch = async (targetBranch: GraphBranch) => {
    if (!graph) {
      setError("Build a blueprint before diffing branches.");
      return;
    }

    setBusyLabel("Computing branch diff");
    setError(null);
    setBranchDiff(null);
    setDiffTargetBranchId(targetBranch.id);

    try {
      const response = await fetch("/api/branches/diff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseGraph: graph,
          compareGraph: targetBranch.graph,
          baseId: activeBranchId ?? "current",
          compareId: targetBranch.id
        })
      });
      const body = (await response.json()) as BranchDiffResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to compute diff.");
      }

      if (body.diff) {
        setBranchDiff(body.diff);
        setShowBranchPanel(true);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Branch diff failed.");
    } finally {
      setBusyLabel(null);
    }
  };
  const renderSection = (title: string, items: string[]) => (
    <div className="callout" key={title}>
      <h3>{title}</h3>
      {items.length ? items.map((item) => <p key={`${title}:${item}`}>{item}</p>) : <p>None.</p>}
    </div>
  );

  const renderBlueprintNodeDocumentation = (node: BlueprintNode) => {
    const contract = normalizeContract(node.contract);

    return [
      renderSection("Responsibilities", contract.responsibilities),
      renderSection("Inputs", contract.inputs.map(formatField)),
      renderSection("Outputs", contract.outputs.map(formatField)),
      renderSection("Attributes / State", contract.attributes.map(formatField)),
      renderSection(
        "Methods",
        contract.methods.map((method) => `${method.signature ?? method.name} - ${method.summary}`)
      ),
      renderSection("Dependencies", contract.dependencies),
      renderSection(
        "Calls",
        contract.calls.map(
          (call) => `${call.target}${call.kind ? ` [${call.kind}]` : ""}${call.description ? ` - ${call.description}` : ""}`
        )
      ),
      renderSection("Side effects", contract.sideEffects),
      renderSection("Errors", contract.errors),
      renderSection("Notes", contract.notes)
    ];
  };

  const renderNodeRuntimeEvidence = (node: BlueprintNode) => {
    const nodeSteps = getNodeExecutionSteps(node.id);
    const testCases = getNodeTestCases(node.id);
    const testResults = getNodeTestResults(node.id);

    if (!nodeSteps.length && !testCases.length && !testResults.length) {
      return null;
    }

    return (
      <div className="callout">
        <h3>Runtime evidence</h3>
        {nodeSteps.length ? <p>{nodeSteps.length} execution step{nodeSteps.length === 1 ? "" : "s"} recorded for this node.</p> : null}
        {nodeSteps.slice(0, 6).map((step) => {
          const artifacts = getArtifactsForStep(step);
          return (
            <div key={step.id} className="smell-item">
              <p>
                <strong>{step.kind.toUpperCase()}</strong> {step.status.toUpperCase()} {step.methodName ? `· ${step.methodName}` : ""}
              </p>
              <p>{step.message}</p>
              {step.inputPreview ? <p>Input: {step.inputPreview}</p> : null}
              {step.outputPreview ? <p>Output: {step.outputPreview}</p> : null}
              {step.blockedByStepId ? <p>Blocked by: {step.blockedByStepId}</p> : null}
              {artifacts.length ? artifacts.slice(0, 3).map((artifact) => <p key={artifact.id}>Artifact: {artifact.preview}</p>) : null}
              {step.contractChecks.slice(0, 3).map((check, index) => (
                <p key={`${step.id}:${check.stage}:${index}`}>
                  {check.stage} {check.status}: {check.message}
                </p>
              ))}
            </div>
          );
        })}
        {testCases.length ? <p>{testCases.length} generated contract test case{testCases.length === 1 ? "" : "s"}.</p> : null}
        {testResults.length
          ? testResults.slice(0, 6).map((result) => (
              <p key={result.caseId}>
                Test {result.kind}: {result.status} · {result.message}
              </p>
            ))
          : null}
      </div>
    );
  };

  const renderCodeEditorPanel = () => {
    if (!activeCodeNode || !activeCodePath) {
      return null;
    }

    return (
      <div className="callout">
        <h3>Live code editor</h3>
        <p>
          Editing <code>{activeCodePath}</code>
        </p>
        <p>
          Phase: <strong>{graph?.phase ?? "spec"}</strong> | Node status: <strong>{activeCodeNode.status}</strong>
        </p>
        <p className="status-meta">
          Every runtime run now includes generated happy-path, edge-case, and invalid-input contract tests for directly runnable nodes.
        </p>
        <p className="status-meta">
          {codeRagQuery.trim()
            ? "CodeRAG search is active. Suggest, implement, and Monaco assistance will use this repo query."
            : `CodeRAG is wired into the coding agent. Without a manual search prompt, the backend derives retrieval context from ${activeCodeNode.name}.`}
        </p>
        <label className="field">
          <span>Editor instructions</span>
          <textarea
            onChange={(event) => setSuggestionInstruction(event.target.value)}
            placeholder="Improve validation, tighten return types, add edge-case handling, preserve current exports..."
            rows={4}
            value={suggestionInstruction}
          />
        </label>
        <div className="button-row">
          <button
            disabled={isBusy || !canImplementActiveNode}
            onClick={() => {
              void handleImplementNode();
            }}
            type="button"
          >
            {busyLabel === "Implementing node" ? "Implementing..." : "Implement node"}
          </button>
          <button
            disabled={isBusy}
            onClick={() => {
              void handleSuggestCode();
            }}
            type="button"
          >
            {busyLabel === "Generating code suggestion" ? "Generating..." : "Suggest code"}
          </button>
          <button
            onClick={() => {
              if (!graph) {
                return;
              }

              const generatedCode = activeCodeNode.specDraft ?? generateNodeCode(activeCodeNode, graph);
              if (!generatedCode) {
                return;
              }

              setCodeDrafts((current) => ({
                ...current,
                [activeCodeNode.id]: generatedCode
              }));
            }}
            type="button"
          >
            Reset to generated code
          </button>
          {codeSuggestion ? (
            <button
              onClick={() =>
                setCodeDrafts((current) => ({
                  ...current,
                  [activeCodeNode.id]: codeSuggestion.code
                }))
              }
              type="button"
            >
              Apply AI suggestion
            </button>
          ) : null}
        </div>
        <label className="field">
          <span>Code editor</span>
          <CodeEditor
            ariaLabel="Code editor"
            completionContext={
              graph
                ? {
                    enabled: liveCompletionReady,
                    graph,
                    nodeId: activeCodeNode.id,
                    retrievalQuery: codeRagQuery.trim() || undefined,
                    retrievalDepth: codeRagDepth,
                    nvidiaApiKey: nvidiaApiKey.trim() || undefined
                  }
                : undefined
            }
            onChange={(value) =>
              setCodeDrafts((current) => ({
                ...current,
                [activeCodeNode.id]: value
              }))
            }
            path={activeCodePath}
            value={activeCodeDraft}
          />
        </label>
        {codeSuggestion ? (
          <div className="code-suggestion-panel">
            <h4>AI suggestion</h4>
            <p>{codeSuggestion.summary}</p>
            {codeSuggestion.notes.length ? (
              <div className="code-suggestion-notes">
                {codeSuggestion.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}
            <CodeEditor
              ariaLabel="Suggested code"
              completionContext={undefined}
              onChange={() => undefined}
              path={`${activeCodePath}.suggested`}
              readOnly
              value={codeSuggestion.code}
            />
          </div>
        ) : null}
        <p className="status-meta">
          {liveCompletionReady
            ? "Live completions are enabled in Monaco. Trigger with . or ( or use manual completion."
            : liveCompletionsEnabled
              ? "Live completions are waiting for a browser or server NVIDIA API key."
              : "Live completions are disabled for this browser."}
        </p>
      </div>
    );
  };

  const renderPrimaryActionButton = () => {
    if (!graph || showPromptPanel) {
      return (
        <button
          aria-label="Toolbar build blueprint"
          className="toolbar-primary-action"
          disabled={isBusy}
          onClick={() => void handleBuild()}
          type="button"
        >
          {busyLabel === "Building blueprint" ? "Building..." : "Build blueprint"}
        </button>
      );
    }

    if (canStartImplementation) {
      return (
        <button className="toolbar-primary-action" disabled={isBusy} onClick={() => void handleAdvanceToImplementation()} type="button">
          {busyLabel === "Auto-implementing nodes" ? "Implementing..." : "Enter Phase 2"}
        </button>
      );
    }

    if (canRunActiveNode) {
      return (
        <button className="toolbar-primary-action" disabled={isBusy} onClick={() => void handleRunExecution()} type="button">
          {busyLabel === "Running node" ? "Running node" : "Run node"}
        </button>
      );
    }

    if (canStartIntegration) {
      return (
        <button className="toolbar-primary-action" disabled={isBusy} onClick={handleAdvanceToIntegration} type="button">
          Enter Phase 3
        </button>
      );
    }

    if (canRunIntegration) {
      return (
        <button className="toolbar-primary-action" disabled={isBusy} onClick={() => void handleRunExecution()} type="button">
          {busyLabel === "Running integration" ? "Running integration" : "Run integration"}
        </button>
      );
    }

    return (
      <button className="toolbar-primary-action" disabled={isBusy} onClick={() => void handleExport()} type="button">
        {busyLabel === "Exporting artifacts" ? "Exporting..." : "Export"}
      </button>
    );
  };

  const renderGraphSurface = (theme: "light" | "dark" = "light") => (
    <GraphCanvas
      activeNodeIds={drilldownRootNode || vcrGraph ? undefined : digitalTwinSnapshot?.activeNodeIds}
      driftedNodeIds={drilldownRootNode ? undefined : refactorReport?.driftedNodeIds}
      edges={detailFlow?.edges}
      executionResult={executionResult}
      ghostNodes={drilldownRootNode ? undefined : ghostSuggestions}
      graph={vcrGraph ?? digitalTwinGraph ?? graph}
      heatmapData={drilldownRootNode ? undefined : heatmapData}
      nodes={detailFlow?.nodes}
      onGhostNodeClick={handleSolidifyGhostNode}
      onNodeDoubleClick={handleGraphDoubleClick}
      onSelect={handleGraphSelect}
      selectedNodeId={drilldownRootNode ? selectedDetailNodeId : selectedNodeId}
      theme={theme}
    />
  );

  const renderPromptComposer = (placement: "overlay" | "sidebar" = "overlay") => {
    const isSidebar = placement === "sidebar";
    const shouldRender = isSidebar ? showPromptPanel : shouldShowPromptComposer;

    return shouldRender ? (
      <div
        className={`prompt-dock${!isSidebar && graph ? " prompt-dock-overlay" : ""}${isSidebar ? " prompt-dock-sidebar" : ""}`}
      >
        <div className="prompt-dock-header">
          <div>
            <p className="brand-eyebrow">Blueprint Input</p>
            <h3>
              {isSidebar
                ? "Drive CodeFlow from the agent rail"
                : graph
                  ? "Adjust the plan without leaving the graph"
                  : "Describe what CodeFlow should build"}
            </h3>
            <p className="prompt-dock-note">
              {isSidebar
                ? "Build, re-run, and steer the blueprint without leaving the IDE."
                : "A calm brief in. A clean graph out."}
            </p>
          </div>
          <CodeflowCatLogo className="prompt-dock-logo" size={34} />
          {graph && !isSidebar ? (
            <button onClick={() => setShowPromptPanel(false)} type="button">
              Hide
            </button>
          ) : null}
        </div>

        <fieldset className="field">
          <span>Input executionMode</span>
          <div className="choice-row">
            <label>
              <input checked={useAI} onChange={() => setUseAI(true)} type="radio" name="dockBuildMode" />
              AI Prompt
            </label>
            <label>
              <input checked={!useAI} onChange={() => setUseAI(false)} type="radio" name="dockBuildMode" />
              PRD / Repo
            </label>
          </div>
        </fieldset>

        {useAI ? (
          <label className="field">
            <span>Describe your project</span>
            <textarea
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="A task management app with a React frontend and Node backend. Or a Rails monolith, a Django app, a Go service, a Swift iOS client, or any other stack you want to visualize."
              rows={graph ? 5 : 8}
              value={aiPrompt}
            />
          </label>
        ) : (
          <div className="prompt-dock-split">
            <label className="field">
              <span>Repo path</span>
              <input
                onChange={(event) => setRepoPath(event.target.value || null)}
                placeholder="/absolute/path/to/repo"
                value={repoPath ?? ""}
              />
            </label>
            <label className="field">
              <span>PRD markdown</span>
              <textarea
                aria-label="PRD markdown"
                onChange={(event) => setPrdText(event.target.value)}
                placeholder="# UI&#10;- Screen: Workspace&#10;&#10;# API&#10;- POST /api/blueprint"
                rows={graph ? 6 : 8}
                value={prdText}
              />
            </label>
          </div>
        )}

        <div className="prompt-dock-actions">
          <button className="toolbar-primary-action" disabled={isBusy} onClick={() => void handleBuild()} type="button">
            {busyLabel === "Building blueprint" ? "Building..." : "Build blueprint"}
          </button>
          <button aria-label="Settings" onClick={() => setShowSettings((current) => !current)} type="button">
            Advanced settings
          </button>
        </div>
      </div>
    ) : null;
  };

  const renderGraphPanel = () => (
    <section className="graph-panel full-graph">
      <div className="graph-header">
        <div>
          <h2>{drilldownRootNode ? `${drilldownRootNode.name} internals` : "Architecture map"}</h2>
          <p>
            {drilldownRootNode && detailFlow
              ? `${detailFlow.nodes.length} internal nodes, ${detailFlow.edges.length} edges`
              : graph
                ? `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.workflows.length} workflows`
                : "No graph yet"}
          </p>
          {drilldownStack.length ? (
            <p>
              {["Architecture", ...drilldownStack.map((nodeId) => graph?.nodes.find((node) => node.id === nodeId)?.name ?? nodeId)].join(
                " / "
              )}
            </p>
          ) : null}
          {!drilldownRootNode && runPlan ? <p>{`${runPlan.tasks.length} tasks across ${runPlan.batches.length} batches`}</p> : null}
        </div>
        <div className="graph-header-actions">
          {drilldownStack.length ? (
            <button disabled={isBusy} onClick={handleDrilldownBack} type="button">
              Back to parent graph
            </button>
          ) : null}
          <button disabled={isBusy || !graph} onClick={handleApplyTraces} type="button">
            Apply trace overlay
          </button>
        </div>
        {!drilldownRootNode && graph?.warnings.length ? (
          <div className="warnings">
            {graph.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </div>

      {renderGraphSurface()}
    </section>
  );

  const renderTerminalDock = () => (
    <div className="ide-dock-section">
      <div className="ide-dock-toolbar">
        <div>
          <p className="panel-kicker">Terminal</p>
          <h3>CodeFlow session</h3>
        </div>
        <div className="button-row">
          <button disabled={isBusy} onClick={() => void handleBuild()} type="button">
            Build
          </button>
          <button disabled={isBusy || !canRunActiveNode && !canRunIntegration} onClick={() => void handleRunExecution()} type="button">
            Run
          </button>
        </div>
      </div>

      {busyLabel ? (
        <div className="ide-terminal-banner">
          <span className="ide-terminal-dot" />
          <strong>{busyLabel}</strong>
        </div>
      ) : null}

      {executionResult ? (
        <div className="callout">
          <h3>Latest execution</h3>
          <p>
            {executionResult.success ? "Success" : "Failure"} · {executionResult.durationMs}ms · exit{" "}
            {executionResult.exitCode ?? "N/A"}
          </p>
          {executionSummary ? (
            <p>
              {executionSummary.passed} passed · {executionSummary.warning} warning ·{" "}
              {executionSummary.failed} failed · {executionSummary.blocked} blocked
            </p>
          ) : null}
          {executionResult.stdout ? <pre className="ide-terminal-output">{executionResult.stdout}</pre> : null}
          {executionResult.stderr ? <pre className="ide-terminal-output is-error">{executionResult.stderr}</pre> : null}
        </div>
      ) : null}

      {exportResult ? (
        <div className="callout">
          <h3>Latest export</h3>
          <p>{exportResult.rootDir}</p>
          {exportResult.artifactSummary ? (
            <p className="status-meta">
              {exportResult.artifactSummary.total} artifacts · {exportResult.artifactSummary.validated} validated
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="ide-terminal-feed">
        {activityFeed.length ? (
          activityFeed
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} className={`ide-terminal-line tone-${entry.tone}`}>
                <span className="ide-terminal-time">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="ide-terminal-source">{entry.source}</span>
                <span className="ide-terminal-message">{entry.message}</span>
                {entry.detail ? <p className="ide-terminal-detail">{entry.detail}</p> : null}
              </div>
            ))
        ) : (
          <p className="status-meta">No session activity yet. Build a blueprint or open a file to start the feed.</p>
        )}
      </div>
    </div>
  );

  const renderHeatmapDock = () => (
    <div className="ide-dock-section">
      <div className="ide-dock-toolbar">
        <div>
          <p className="panel-kicker">Heatmap</p>
          <h3>Live node pressure</h3>
        </div>
        <div className="button-row">
          <button disabled={isBusy} onClick={() => void handleLoadObservability()} type="button">
            Refresh
          </button>
          <label className="choice-toggle compact-toggle">
            <input
              aria-label="Live polling"
              checked={autoObservability}
              onChange={(event) => setAutoObservability(event.target.checked)}
              type="checkbox"
            />
            Live polling
          </label>
        </div>
      </div>

      {observabilityLastUpdatedAt ? (
        <p className="status-meta">Last updated: {new Date(observabilityLastUpdatedAt).toLocaleString()}</p>
      ) : null}
      {observabilityPollError ? <p className="error">Polling stale: {observabilityPollError}</p> : null}

      {heatmapData ? (
        <div className="callout">
          <h3>Hot paths</h3>
          <table className="heatmap-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Calls</th>
                <th>Errors</th>
                <th>Avg ms</th>
                <th>Heat</th>
              </tr>
            </thead>
            <tbody>
              {heatmapData.nodes
                .slice()
                .sort((a, b) => b.heatIntensity - a.heatIntensity)
                .map((metric) => (
                  <tr
                    key={metric.nodeId}
                    className={
                      metric.heatIntensity > 0.66
                        ? "heat-row-hot"
                        : metric.heatIntensity > 0.33
                          ? "heat-row-warm"
                          : ""
                    }
                  >
                    <td title={metric.nodeId}>{metric.name}</td>
                    <td>{metric.callCount}</td>
                    <td>{metric.errorCount}</td>
                    <td>{metric.avgDurationMs.toFixed(1)}</td>
                    <td>
                      <div className="heat-bar-track">
                        <div
                          className="heat-bar-fill"
                          style={{ width: `${Math.round(metric.heatIntensity * 100)}%` }}
                        />
                        <span className="heat-bar-label">{Math.round(metric.heatIntensity * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="callout">
          <p>Apply trace spans or refresh observability to populate heat.</p>
        </div>
      )}
    </div>
  );

  const renderVcrDock = () => (
    <div className="ide-dock-section">
      <div className="ide-dock-toolbar">
        <div>
          <p className="panel-kicker">VCR</p>
          <h3>Execution replay</h3>
        </div>
        <button disabled={isBusy} onClick={() => void handleLoadVcrRecording()} type="button">
          {busyLabel === "Loading VCR recording" ? "Loading..." : "Load recording"}
        </button>
      </div>

      {vcrError ? <p className="error">{vcrError}</p> : null}

      {vcrRecording ? (
        <>
          <div className="panel-stat-grid">
            <div className="panel-stat-card">
              <span className="panel-stat-label">Frames</span>
              <strong>{vcrRecording.frames.length}</strong>
              <span>Replay snapshots</span>
            </div>
            <div className="panel-stat-card">
              <span className="panel-stat-label">Cursor</span>
              <strong>{vcrFrameIndex + 1}</strong>
              <span>Current frame</span>
            </div>
            <div className="panel-stat-card">
              <span className="panel-stat-label">Playback</span>
              <strong>{vcrPlaying ? "Playing" : "Paused"}</strong>
              <span>{vcrRecording.frames[vcrFrameIndex]?.status ?? "idle"}</span>
            </div>
          </div>

          <div className="callout">
            <h3>Scrub bar</h3>
            <input
              aria-label="VCR scrub bar"
              className="vcr-scrub-bar"
              max={vcrRecording.frames.length - 1}
              min={0}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const clamped = Math.min(vcrRecording.frames.length - 1, Math.max(0, raw));
                setVcrFrameIndex(clamped);
              }}
              step={1}
              type="range"
              value={vcrFrameIndex}
            />
            <div className="button-row vcr-controls">
              <button disabled={vcrFrameIndex === 0} onClick={() => { setVcrPlaying(false); setVcrFrameIndex(0); }} type="button">⏮</button>
              <button disabled={vcrFrameIndex === 0} onClick={() => { setVcrPlaying(false); setVcrFrameIndex((prev) => Math.max(0, prev - 1)); }} type="button">◀</button>
              <button onClick={() => setVcrPlaying((prev) => !prev)} type="button">{vcrPlaying ? "⏸" : "▶"}</button>
              <button disabled={vcrFrameIndex >= vcrRecording.frames.length - 1} onClick={() => { setVcrPlaying(false); setVcrFrameIndex((prev) => Math.min(vcrRecording.frames.length - 1, prev + 1)); }} type="button">▶|</button>
              <button disabled={vcrFrameIndex >= vcrRecording.frames.length - 1} onClick={() => { setVcrPlaying(false); setVcrFrameIndex(vcrRecording.frames.length - 1); }} type="button">⏭</button>
            </div>
          </div>

          {vcrRecording.frames[vcrFrameIndex] ? (
            <div className="callout">
              <h3>Current frame</h3>
              <p><strong>Span:</strong> {vcrRecording.frames[vcrFrameIndex].label}</p>
              {vcrRecording.frames[vcrFrameIndex].nodeName ? (
                <p><strong>Node:</strong> {vcrRecording.frames[vcrFrameIndex].nodeName}</p>
              ) : null}
              <p><strong>Duration:</strong> {vcrRecording.frames[vcrFrameIndex].durationMs}ms</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="callout">
          <p>Load a recording to scrub execution history inside the IDE.</p>
        </div>
      )}
    </div>
  );

  const renderTracesDock = () => (
    <div className="ide-dock-section">
      <div className="ide-dock-toolbar">
        <div>
          <p className="panel-kicker">Traces</p>
          <h3>Spans, logs, and Digital Twin</h3>
        </div>
        <div className="button-row">
          <button disabled={isBusy} onClick={() => void handleLoadDigitalTwin()} type="button">
            Refresh twin
          </button>
          <button disabled={isBusy || !simulateNodeIds.trim()} onClick={() => void handleSimulateAction()} type="button">
            Simulate
          </button>
        </div>
      </div>

      {latestSpans?.length ? (
        <div className="callout">
          <h3>Recent spans</h3>
          {latestSpans.slice(0, 10).map((span) => (
            <div key={span.spanId} className={`obs-span-row obs-span-${span.status}`}>
              <span className="obs-span-status">{span.status.toUpperCase()}</span>
              <span className="obs-span-name">{span.name}</span>
              <span className="obs-span-meta">[{span.runtime} · {span.provenance ?? "observed"}]</span>
            </div>
          ))}
        </div>
      ) : null}

      {latestLogs.length ? (
        <div className="callout">
          <h3>Recent logs</h3>
          {latestLogs.slice(0, 10).map((log) => (
            <div key={log.id} className={`obs-log-row obs-log-${log.level}`}>
              <span className="obs-log-level">{log.level.toUpperCase()}</span>
              <span className="obs-log-message">{log.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="callout">
        <h3>Digital Twin</h3>
        <label className="field">
          <span>Active window (seconds)</span>
          <input
            aria-label="Active window seconds"
            min={1}
            onChange={(event) => {
              const rawValue = Number(event.target.value);
              if (!Number.isFinite(rawValue)) {
                return;
              }
              setDigitalTwinWindowSecs(Math.max(1, Math.floor(rawValue)));
            }}
            type="number"
            value={digitalTwinWindowSecs}
          />
        </label>
        <label className="field">
          <span>Node IDs</span>
          <textarea
            aria-label="Node IDs to simulate"
            onChange={(event) => setSimulateNodeIds(event.target.value)}
            placeholder={graph?.nodes.slice(0, 2).map((node) => node.id).join("\n") ?? ""}
            rows={3}
            value={simulateNodeIds}
          />
        </label>
        <label className="field">
          <span>Flow label</span>
          <input onChange={(event) => setSimulateLabel(event.target.value)} value={simulateLabel} />
        </label>
        {digitalTwinSnapshot ? (
          <>
            <p className="status-meta">
              {digitalTwinSnapshot.activeNodeIds.length} active nodes · {digitalTwinSnapshot.observedSpanCount} observed spans · {digitalTwinSnapshot.simulatedSpanCount} simulated spans
            </p>
            <p className="status-meta">
              Last updated: {new Date(digitalTwinLastUpdatedAt ?? digitalTwinSnapshot.computedAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="status-meta">Refresh the Digital Twin to mirror current traffic.</p>
        )}
        {digitalTwinError ? <p className="error">{digitalTwinError}</p> : null}
        {digitalTwinPollError ? <p className="error">Polling stale: {digitalTwinPollError}</p> : null}
      </div>
    </div>
  );

  const renderProblemsDock = () => (
    <div className="ide-dock-section">
      <div className="ide-dock-toolbar">
        <div>
          <p className="panel-kicker">Problems</p>
          <h3>Warnings, drift, and health</h3>
        </div>
        <div className="button-row">
          <button disabled={isBusy || !graph} onClick={() => void handleRunAnalysis()} type="button">
            Analyze
          </button>
          <button disabled={isBusy || !graph} onClick={() => void handleDetectDrift()} type="button">
            Detect drift
          </button>
          <button disabled={isBusy || !refactorReport || refactorReport.isHealthy} onClick={() => void handleHealArchitecture()} type="button">
            Heal
          </button>
        </div>
      </div>

      {error ? (
        <div className="callout danger-callout">
          <h3>Current error</h3>
          <p>{error}</p>
        </div>
      ) : null}

      {graph?.warnings.length ? (
        <div className="callout">
          <h3>Graph warnings</h3>
          {graph.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {riskReport ? (
        <div className="callout">
          <h3>Risk report</h3>
          <p>{riskReport.level.toUpperCase()} ({riskReport.score})</p>
          {riskReport.factors.length
            ? riskReport.factors.map((factor) => <p key={factor.code}>{factor.message}</p>)
            : <p>No notable export risks detected.</p>}
        </div>
      ) : null}

      {conflictReport ? (
        <div className="callout">
          <h3>Repo conflicts</h3>
          <p>{conflictReport.conflicts.length} conflict{conflictReport.conflicts.length === 1 ? "" : "s"}</p>
          {conflictReport.conflicts.slice(0, 8).map((conflict) => (
            <p key={`${conflict.kind}:${conflict.message}`}>{conflict.message}</p>
          ))}
        </div>
      ) : null}

      {graphMetrics ? (
        <div className="callout">
          <h3>Graph Metrics</h3>
          <p>{graphMetrics.nodeCount} nodes</p>
          <p>{graphMetrics.edgeCount} edges</p>
          <p>Density {graphMetrics.density.toFixed(3)}</p>
          <p>Avg degree {graphMetrics.avgDegree.toFixed(1)}</p>
        </div>
      ) : null}

      {smellReport ? (
        <div className="callout">
          <h3>Architecture Health: {smellReport.healthScore}/100</h3>
          <p>{smellReport.totalSmells} smell{smellReport.totalSmells === 1 ? "" : "s"} detected</p>
          {smellReport.smells.length
            ? smellReport.smells.slice(0, 8).map((smell, index) => (
                <p key={`${smell.code}:${smell.nodeId ?? "global"}:${index}`}>
                  {smell.severity.toUpperCase()} [{smell.code}] {smell.message}
                </p>
              ))
            : <p>No architecture smells detected.</p>}
        </div>
      ) : null}

      {cycleReport ? (
        <div className="callout">
          <h3>Dependency cycles</h3>
          <p>{cycleReport.totalCycles} cycle{cycleReport.totalCycles === 1 ? "" : "s"} detected</p>
          {cycleReport.cycles.length ? (
            cycleReport.cycles.slice(0, 5).map((cycle, index) => (
              <p key={`${cycle.nodeIds.join(":")}:${index}`}>{cycle.nodeIds.join(" → ")}</p>
            ))
          ) : (
            <p>No dependency cycles found. Graph is a clean DAG!</p>
          )}
        </div>
      ) : null}

      {refactorReport ? (
        <div className="callout">
          <h3>{refactorReport.isHealthy ? "Architecture healthy" : "Drift report"}</h3>
          <p className="status-meta">
            {refactorReport.scope} · {refactorReport.provenance} · {refactorReport.maturity}
          </p>
          {!refactorReport.isHealthy
            ? refactorReport.issues.slice(0, 8).map((issue, index) => (
                <p key={`${issue.kind}:${issue.nodeId ?? "global"}:${index}`}>{issue.description}</p>
              ))
            : <p>No drift issues detected.</p>}
        </div>
      ) : null}

      {healResult ? (
        <div className="callout">
          <h3>Last heal</h3>
          <p>{healResult.issuesFixed} issues fixed</p>
          {healResult.summary.slice(0, 6).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}

      {mermaidDiagram ? (
        <div className="callout">
          <h3>Mermaid</h3>
          <pre className="mermaid-output">{mermaidDiagram}</pre>
        </div>
      ) : null}
    </div>
  );

  const renderIdeBottomPanel = () => {
    const problemCount =
      (error ? 1 : 0) +
      (graph?.warnings.length ?? 0) +
      (conflictReport?.conflicts.length ?? 0) +
      (smellReport?.totalSmells ?? 0) +
      (cycleReport?.totalCycles ?? 0) +
      (refactorReport?.totalIssues ?? 0);
    const traceCount = (latestSpans?.length ?? 0) + latestLogs.length;
    const tabs: Array<{ id: IdeDockTab; label: string; badge?: number; content: ReactNode }> = [
      { id: "terminal", label: "terminal", badge: activityFeed.length || undefined, content: renderTerminalDock() },
      { id: "heatmap", label: "heatmap", badge: heatmapData?.nodes.length || undefined, content: renderHeatmapDock() },
      { id: "vcr", label: "vcr", badge: vcrRecording?.frames.length || undefined, content: renderVcrDock() },
      { id: "traces", label: "traces", badge: traceCount || undefined, content: renderTracesDock() },
      { id: "problems", label: "problems", badge: problemCount || undefined, content: renderProblemsDock() }
    ];

    return (
      <div className="ide-dock-shell">
        <div className="ide-dock-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-selected={activeDockTab === tab.id}
              className={`ide-dock-tab${activeDockTab === tab.id ? " is-active" : ""}`}
              onClick={() => setActiveDockTab(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.label}</span>
              {tab.badge ? <span className="ide-dock-tab-badge">{tab.badge}</span> : null}
            </button>
          ))}
        </div>
        <div className="ide-dock-panel" role="tabpanel">
          {tabs.find((tab) => tab.id === activeDockTab)?.content}
        </div>
      </div>
    );
  };

  const renderIdeSidebar = () => {
    const sidebarNode = selectedNode;
    const sidebarContract = sidebarNode ? normalizeContract(sidebarNode.contract) : null;
    const sourceNavigationTarget = sidebarNode ? getNavigationTarget(sidebarNode) : null;
    const codeRagPrimaryNode = codeRagResult?.context.primaryNode ?? null;
    const codeRagRelatedNodes = codeRagResult?.context.relatedNodes ?? [];
    const openCodeRagContext = (node: RetrievedNodeContext) =>
      handleOpenFile(node.filePath, {
        filePath: node.filePath,
        lineNumber: node.startLine,
        endLineNumber: node.endLine,
        columnStart: 1,
        symbolName: node.name
      });

    return (
      <div className="ide-agent-slot">
        <div className="ide-side-section">
          <p className="panel-kicker">CodeFlow IDE</p>
          <h2>Agent rail</h2>
          <p className="status-meta">
            The graph stays live in the editor while builds, analysis, traces, and runtime controls stay docked here and below.
          </p>
          <div className="ide-chip-row">
            <span className="executionMode-pill">Phase {graph?.phase ?? "spec"}</span>
            <span className="executionMode-pill">{useAI ? "AI blueprint" : "Repo blueprint"}</span>
            <span className="executionMode-pill">{executionMode}</span>
          </div>
        </div>

        {renderPromptComposer("sidebar")}

        <div className="ide-side-section">
          <div className="ide-side-section-header">
            <h3>Controls</h3>
            <button onClick={() => setShowPromptPanel((current) => !current)} type="button">
              {showPromptPanel ? "Hide prompt" : "Show prompt"}
            </button>
          </div>
          <p className="status-meta">{apiKeyStatus}</p>
          <div className="button-row">
            <button disabled={isBusy} onClick={() => void handleBuild()} type="button">Build</button>
            <button disabled={isBusy || !graph} onClick={() => void handleRunAnalysis()} type="button">Analyze graph</button>
            <button disabled={isBusy || !graph} onClick={() => setActiveDockTab("traces")} type="button">Traces</button>
            <button disabled={isBusy || !graph} onClick={() => setActiveDockTab("problems")} type="button">Problems</button>
          </div>
          <div className="button-row">
            <button disabled={isBusy || !canImplementActiveNode} onClick={() => void handleImplementNode()} type="button">Implement</button>
            <button disabled={isBusy || !canRunActiveNode && !canRunIntegration} onClick={() => void handleRunExecution()} type="button">Run</button>
            <button disabled={isBusy || !graph} onClick={() => void handleLoadObservability()} type="button">Heatmap</button>
            <button disabled={isBusy || !graph} onClick={() => void handleLoadVcrRecording()} type="button">VCR</button>
          </div>
        </div>

        <div className="ide-side-section">
          <div className="ide-side-section-header">
            <h3>Repo context</h3>
            <button disabled={codeRagLoading} onClick={() => void refreshCodeRagStatus(true)} type="button">
              Refresh
            </button>
          </div>
          <p className="status-meta">{codeRagMessage}</p>
          <p className="status-meta">
            This search prompt feeds the backend CodeRAG engine. Its retrieved context is injected into Suggest code, Implement node, and Monaco completions.
          </p>
          <label className="field">
            <span>Search prompt</span>
            <textarea
              onChange={(event) => setCodeRagQuery(event.target.value)}
              placeholder="Where is auth validated, what calls it, and which files should the coding agent inspect?"
              rows={3}
              value={codeRagQuery}
            />
          </label>
          <label className="field">
            <span>Traversal depth</span>
            <input
              max={6}
              min={1}
              onChange={(event) => {
                const nextDepth = Number(event.target.value);
                if (!Number.isFinite(nextDepth)) {
                  return;
                }

                setCodeRagDepth(Math.max(1, Math.min(6, Math.floor(nextDepth))));
              }}
              type="number"
              value={codeRagDepth}
            />
          </label>
          <div className="button-row">
            <button
              disabled={codeRagLoading || codeRagStatus !== "ready" || !codeRagQuery.trim()}
              onClick={() => void handleRunCodeRagQuery()}
              type="button"
            >
              {codeRagLoading ? "Searching..." : "Search repo"}
            </button>
            {sidebarNode ? (
              <button
                onClick={() => setCodeRagQuery(`Explain ${sidebarNode.name} and what it touches.`)}
                type="button"
              >
                Use selection
              </button>
            ) : null}
          </div>

          {codeRagError ? (
            <div className="callout danger-callout">
              <p>{codeRagError}</p>
            </div>
          ) : null}

          {codeRagResult ? (
            <div className="coderag-results">
              <div className="callout">
                <h3>Answer</h3>
                <p className="coderag-answer">{codeRagResult.answer}</p>
              </div>

              {codeRagPrimaryNode ? (
                <div className="callout coderag-node-card">
                  <div className="coderag-node-meta">
                    <span className="node-tag">Primary</span>
                    <span className="status-meta">{codeRagPrimaryNode.kind}</span>
                  </div>
                  <p><strong>{codeRagPrimaryNode.name}</strong></p>
                  <p className="status-meta">
                    {codeRagPrimaryNode.filePath}:{codeRagPrimaryNode.startLine}-{codeRagPrimaryNode.endLine}
                  </p>
                  <p>{codeRagPrimaryNode.doc}</p>
                  <button onClick={() => openCodeRagContext(codeRagPrimaryNode)} type="button">
                    Open primary node
                  </button>
                </div>
              ) : null}

              {codeRagRelatedNodes.length ? (
                <div className="callout">
                  <h3>Related nodes</h3>
                  <div className="coderag-related-list">
                    {codeRagRelatedNodes.slice(0, 4).map((node) => (
                      <div key={`${node.relationship}:${node.nodeId}`} className="coderag-related-item">
                        <div>
                          <p><strong>{node.name}</strong></p>
                          <p className="status-meta">
                            {node.relationship} · {node.filePath}:{node.startLine}
                          </p>
                        </div>
                        <button onClick={() => openCodeRagContext(node)} type="button">
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="callout">
              <p>
                {codeRagStatus === "ready"
                  ? "Search the repo to pin retrieval context for the coding agent and editor."
                  : "Build or export a repo-backed blueprint to initialize CodeRAG for this workspace."}
              </p>
            </div>
          )}
        </div>

        {navigationError ? (
          <div className="callout danger-callout">
            <h3>Navigation</h3>
            <p>{navigationError}</p>
          </div>
        ) : null}

        {editorRevealTarget ? (
          <div className="callout">
            <h3>Focused source</h3>
            <p>{formatNavigationTarget(editorRevealTarget)}</p>
          </div>
        ) : null}

        {activeFile ? (
          <div className="callout">
            <h3>Editor session</h3>
            <p>{activeFile}</p>
            <p>{openFiles.length} open tab{openFiles.length === 1 ? "" : "s"}</p>
            {activeCodeNode ? <p>Code node: {activeCodeNode.name}</p> : null}
          </div>
        ) : (
          <div className="callout">
            <h3>Editor session</h3>
            <p>No file open. The graph owns the main area until you choose a file from the explorer.</p>
          </div>
        )}

        {sidebarNode ? (
          <div className="callout">
            <h3>Selected node</h3>
            <p><strong>{sidebarNode.name}</strong></p>
            <p>{sidebarNode.summary}</p>
            {sourceNavigationTarget && isValidNavigationTarget(sourceNavigationTarget) ? (
              <button onClick={() => handleOpenNodeSource(sidebarNode.id)} type="button">
                Open source
              </button>
            ) : null}
            {sidebarContract?.responsibilities.length ? (
              <>
                <h4>Responsibilities</h4>
                {sidebarContract.responsibilities.slice(0, 4).map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </>
            ) : null}
            {sidebarContract?.calls.length ? (
              <>
                <h4>Calls</h4>
                {sidebarContract.calls.slice(0, 4).map((call) => (
                  <p key={`${call.target}:${call.kind ?? ""}`}>
                    {call.target}{call.kind ? ` [${call.kind}]` : ""}
                  </p>
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        {drilldownRootNode && selectedDetailItem ? (
          <div className="callout">
            <h3>Internal selection</h3>
            <p><strong>{selectedDetailItem.label}</strong></p>
            <p>{selectedDetailItem.summary}</p>
            {selectedDetailItem.sections.map((section) => (
              <div key={section.title}>
                <h4>{section.title}</h4>
                {section.items.map((item) => (
                  <p key={`${section.title}:${item}`}>{item}</p>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {!activeFile && activeCodeNode ? renderCodeEditorPanel() : null}
      </div>
    );
  };

  return (
    <div className="workbench-shell">
      <header className="workbench-topbar workbench-topbar-refined">
        <div ref={toolbarRef} className="toolbar-shell">
          <ToolbarMenu
            active={openToolbarMenu === "brand"}
            label={
              <span className="toolbar-brand-trigger">
                <CodeflowCatLogo size={18} />
                CodeFlow
              </span>
            }
            onToggle={() => setOpenToolbarMenu((current) => (current === "brand" ? null : "brand"))}
          >
            <div className="brand-popover">
              <button className="brand-button" onClick={() => runToolbarAction(() => setShowMascotPanel((current) => !current))} type="button">
                <CodeflowCatLogo size={44} />
                <span>
                  <strong>CodeFlow</strong>
                  <small>v0.1.0 · Blueprint Studio</small>
                </span>
              </button>
              <div className="brand-facts">
                <p>Phase: {graph?.phase ?? "spec"}</p>
                <p>Nodes: {graph?.nodes.length ?? 0}</p>
                <p>Workflows: {graph?.workflows.length ?? 0}</p>
                <p>Mode: {executionMode}</p>
              </div>
            </div>
          </ToolbarMenu>

          <div className="toolbar-cluster">
            <ToolbarMenu
              active={openToolbarMenu === "build"}
              label="Build"
              onToggle={() => setOpenToolbarMenu((current) => (current === "build" ? null : "build"))}
            >
              <ToolbarMenuSection title="Flow">
                <button onClick={() => runToolbarAction(() => setShowPromptPanel((current) => !current))} type="button">
                  {showPromptPanel ? "Hide prompt" : "Open prompt"}
                </button>
                <button disabled={isBusy} onClick={() => runToolbarAction(() => void handleBuild())} type="button">
                  {busyLabel === "Building blueprint" ? "Building..." : "Build blueprint"}
                </button>
                <button
                  disabled={isBusy || !canStartImplementation}
                  onClick={() => runToolbarAction(() => void handleAdvanceToImplementation())}
                  type="button"
                >
                  Enter Phase 2
                </button>
                <button disabled={isBusy || !canRunActiveNode} onClick={() => runToolbarAction(() => void handleRunExecution())} type="button">
                  Run node
                </button>
                <button disabled={isBusy || !canStartIntegration} onClick={() => runToolbarAction(handleAdvanceToIntegration)} type="button">
                  Enter Phase 3
                </button>
                <button disabled={isBusy || !canRunIntegration} onClick={() => runToolbarAction(() => void handleRunExecution())} type="button">
                  Run integration
                </button>
                <button disabled={isBusy} onClick={() => runToolbarAction(() => void handleExport())} type="button">
                  Export
                </button>
              </ToolbarMenuSection>
            </ToolbarMenu>

            <ToolbarMenu
              active={openToolbarMenu === "view"}
              label="View"
              onToggle={() => setOpenToolbarMenu((current) => (current === "view" ? null : "view"))}
            >
              <ToolbarMenuSection title="Panels">
                <button onClick={() => runToolbarAction(() => setShowPromptPanel((current) => !current))} type="button">
                  {showPromptPanel ? "Hide prompt" : "Show prompt"}
                </button>
                <button disabled={!selectedNode && !selectedDetailItem} onClick={() => runToolbarAction(() => setShowInspector((current) => !current))} type="button">
                  {showInspector ? "Hide inspector" : "Show inspector"}
                </button>
                <button onClick={() => runToolbarAction(() => setShowMascotPanel((current) => !current))} type="button">
                  {showMascotPanel ? "Hide mascot" : "Show mascot"}
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setShowPhasePanel((current) => !current))} type="button">
                  {showPhasePanel ? "Hide phase stats" : "Show phase stats"}
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setActiveDockTab("heatmap"))} type="button">
                  Heatmap
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setActiveDockTab("vcr"))} type="button">
                  VCR Replay
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setActiveDockTab("traces"))} type="button">
                  Traces
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setActiveDockTab("problems"))} type="button">
                  Problems
                </button>
              </ToolbarMenuSection>
            </ToolbarMenu>

            <ToolbarMenu
              active={openToolbarMenu === "tools"}
              label="Tools"
              onToggle={() => setOpenToolbarMenu((current) => (current === "tools" ? null : "tools"))}
            >
              <ToolbarMenuSection title="Architecture">
                <button disabled={isBusy || !graph} onClick={() => runToolbarAction(() => void handleRunAnalysis())} type="button">
                  Analyze
                </button>
                <button disabled={isBusy || !graph} onClick={() => runToolbarAction(() => void handleSuggestGhostNodes())} type="button">
                  Suggest nodes
                </button>
                <button disabled={!ghostSuggestions.length} onClick={() => runToolbarAction(() => setGhostSuggestions([]))} type="button">
                  Clear ghosts
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setActiveDockTab("problems"))} type="button">
                  Problems / heal
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setShowGeneticPanel((current) => !current))} type="button">
                  {showGeneticPanel ? "Hide evolution" : "Evolution"}
                </button>
              </ToolbarMenuSection>
              <ToolbarMenuSection title="Workspace">
                <button disabled={!graph} onClick={() => runToolbarAction(() => setShowEditPanel((current) => !current))} type="button">
                  {showEditPanel ? "Hide edit graph" : "Edit graph"}
                </button>
                <button
                  disabled={!graph}
                  onClick={() =>
                    runToolbarAction(() => {
                      setShowBranchPanel((current) => !current);
                      if (!showBranchPanel) {
                        void handleLoadBranches();
                      }
                    })
                  }
                  type="button"
                >
                  {showBranchPanel ? "Hide branches" : `Branches${branches.length ? ` (${branches.length})` : ""}`}
                </button>
                <button disabled={!graph} onClick={() => runToolbarAction(() => setShowMcpPanel((current) => !current))} type="button">
                  {showMcpPanel ? "Hide MCP" : "MCP"}
                </button>
                <button onClick={() => runToolbarAction(() => setShowSettings((current) => !current))} type="button">
                  {showSettings ? "Hide settings" : "Settings"}
                </button>
              </ToolbarMenuSection>
            </ToolbarMenu>
          </div>

          <div className="toolbar-meta">
            <div aria-live={statusTone === "danger" ? "assertive" : "polite"} className={toolbarStatusToneClass} role="status">
              <strong>{toolbarStatusLabel}</strong>
              <span>{statusDetail}</span>
            </div>
            {renderPrimaryActionButton()}
          </div>
        </div>
      </header>

      {showSettings ? (
        <aside className="floating-panel settings-panel">
          <div className="floating-panel-header">
            <h2>Settings</h2>
            <button onClick={() => setShowSettings(false)} type="button">
              Close
            </button>
          </div>
          <label className="field">
            <span>Project name</span>
            <input aria-label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <fieldset className="field">
            <span>Build mode</span>
            <div className="choice-row">
              <label>
                <input
                  aria-label="AI Prompt (NVIDIA)"
                  checked={useAI}
                  onChange={() => setUseAI(true)}
                  type="radio"
                  name="buildMode"
                />
                AI Prompt (NVIDIA)
              </label>
              <label>
                <input
                  aria-label="PRD / Repo (JS/TS)"
                  checked={!useAI}
                  onChange={() => setUseAI(false)}
                  type="radio"
                  name="buildMode"
                />
                PRD / Repo (JS/TS)
              </label>
            </div>
          </fieldset>
          <fieldset className="field">
            <span>Execution executionMode</span>
            <div className="choice-row">
              <label>
                <input checked={executionMode === "essential"} onChange={() => setExecutionMode("essential")} type="radio" name="executionMode" />
                Essential
              </label>
              <label>
                <input checked={executionMode === "yolo"} onChange={() => setExecutionMode("yolo")} type="radio" name="executionMode" />
                Yolo
              </label>
            </div>
          </fieldset>
          <label className="field">
            <span>NVIDIA API Key</span>
            <input
              type="password"
              value={nvidiaApiKey}
              onChange={(event) => setNvidiaApiKey(event.target.value)}
              placeholder="nvapi-..."
            />
            <small>Status: {apiKeyStatus}</small>
          </label>
          <label className="choice-toggle">
            <input
              aria-label="Live completions"
              checked={liveCompletionsEnabled}
              onChange={(event) => setLiveCompletionsEnabled(event.target.checked)}
              type="checkbox"
            />
            Live completions
          </label>
          <label className="choice-toggle">
            <input
              aria-label="Auto implement nodes"
              checked={autoImplementNodes}
              onChange={(event) => setAutoImplementNodes(event.target.checked)}
              type="checkbox"
            />
            Auto implement each node in Phase 2
          </label>
          <label className="choice-toggle">
            <input
              aria-label="Live observability polling"
              checked={autoObservability}
              onChange={(event) => setAutoObservability(event.target.checked)}
              type="checkbox"
            />
            Auto-poll observability
          </label>
          {autoObservability ? (
            <label className="field">
              <span>Poll interval (seconds)</span>
              <input
                type="number"
                min={MIN_OBSERVABILITY_INTERVAL_SECS}
                max={60}
                value={observabilityIntervalSecs}
                onChange={(event) => {
                  const raw = event.target.value;
                  // Ignore updates when the input is empty or not a finite number.
                  if (raw === "") {
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed)) {
                    return;
                  }
                  const clamped = Math.min(60, Math.max(MIN_OBSERVABILITY_INTERVAL_SECS, parsed));
                  setObservabilityIntervalSecs(clamped);
                }}
              />
            </label>
          ) : null}
          <label className="field">
            <span>Run input (JSON or string)</span>
            <textarea
              value={runInput}
              onChange={(event) => setRunInput(event.target.value)}
              rows={4}
              placeholder='{"task":"draft docs"}'
            />
          </label>
          <label className="field">
            <span>Output directory</span>
            <input
              value={outputDir}
              onChange={(event) => setOutputDir(event.target.value)}
              placeholder="/absolute/path/for/artifacts"
            />
          </label>
          <label className="field">
            <span>Trace spans JSON</span>
            <textarea
              value={traceInput}
              onChange={(event) => setTraceInput(event.target.value)}
              rows={6}
              placeholder='[{"spanId":"1","traceId":"t1","name":"saveTask","status":"error","durationMs":4,"runtime":"node"}]'
            />
          </label>
          <div className="button-row">
            <button disabled={isBusy} onClick={() => void handleLoadObservability()} type="button">
              Observability
            </button>
            <button disabled={isBusy} onClick={() => void handleAnalyzeConflicts()} type="button">
              Analyze drift
            </button>
          </div>
        </aside>
      ) : null}

      {showEditPanel && graph ? (
        <section className="floating-panel edit-panel">
          <div className="floating-panel-header">
            <h2>Edit graph</h2>
            <button onClick={() => setShowEditPanel(false)} type="button">
              Hide
            </button>
          </div>
          <label className="field">
            <span>New node name</span>
            <input value={newNodeName} onChange={(event) => setNewNodeName(event.target.value)} />
          </label>
          <label className="field">
            <span>New node kind</span>
            <select value={newNodeKind} onChange={(event) => setNewNodeKind(event.target.value as BlueprintNode["kind"])}>
              <option value="function">Function</option>
              <option value="api">API</option>
              <option value="ui-screen">UI Screen</option>
              <option value="class">Class</option>
              <option value="module">Module</option>
            </select>
          </label>
          <button disabled={isBusy} onClick={handleAddNode} type="button">
            Add node
          </button>
          <label className="field">
            <span>Edge from</span>
            <select value={edgeFrom} onChange={(event) => setEdgeFrom(event.target.value)}>
              <option value="">Select a source</option>
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Edge to</span>
            <select value={edgeTo} onChange={(event) => setEdgeTo(event.target.value)}>
              <option value="">Select a target</option>
              {graph.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Edge kind</span>
            <select value={edgeKind} onChange={(event) => setEdgeKind(event.target.value as typeof edgeKind)}>
              <option value="calls">Calls</option>
              <option value="imports">Imports</option>
              <option value="inherits">Inherits</option>
            </select>
          </label>
          <button disabled={isBusy} onClick={handleAddEdge} type="button">
            Add edge
          </button>
        </section>
      ) : null}

      {showBranchPanel && graph ? (
        <section className="floating-panel branch-panel">
          <div className="floating-panel-header">
            <h2>Time-Travel Branches</h2>
            <button onClick={() => setShowBranchPanel(false)} type="button">
              Hide
            </button>
          </div>
          <p className="lead">
            Snapshot the current graph as a named branch to safely experiment with &#x2018;what if&#x2019; scenarios.
            Switch back to any branch at any time, or compare two branches side-by-side.
          </p>

          <div className="callout">
            <h3>Create a new branch</h3>
            <label className="field">
              <span>Branch name</span>
              <input
                value={newBranchName}
                onChange={(event) => setNewBranchName(event.target.value)}
                placeholder="e.g. swap-postgres-for-mongo"
              />
            </label>
            <label className="field">
              <span>Description (optional)</span>
              <input
                value={newBranchDescription}
                onChange={(event) => setNewBranchDescription(event.target.value)}
                placeholder="What are you experimenting with?"
              />
            </label>
            <button
              disabled={isBusy || !newBranchName.trim()}
              onClick={() => void handleCreateBranch()}
              type="button"
            >
              {busyLabel === "Creating branch" ? "Creating..." : "Save as branch"}
            </button>
          </div>

          {branches.length > 0 ? (
            <div className="callout">
              <h3>Saved branches</h3>
              {branches.map((branch) => (
                <div key={branch.id} className="branch-item">
                  <div className="branch-item-header">
                    <span className="branch-name">
                      {activeBranchId === branch.id ? "★ " : ""}
                      {branch.name}
                    </span>
                    <small className="branch-meta">
                      {new Date(branch.createdAt).toLocaleString()} · {branch.graph.nodes.length} nodes
                    </small>
                  </div>
                  {branch.description ? <p className="branch-description">{branch.description}</p> : null}
                  <div className="button-row">
                    <button
                      disabled={isBusy}
                      onClick={() => handleSwitchToBranch(branch)}
                      type="button"
                    >
                      Switch to this branch
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => void handleDiffBranch(branch)}
                      type="button"
                    >
                      {busyLabel === "Computing branch diff" && diffTargetBranchId === branch.id
                        ? "Comparing..."
                        : "Diff vs current"}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => void handleDeleteBranch(branch.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="callout">
              <p>No branches yet. Use &#x201C;Save as branch&#x201D; to snapshot the current graph.</p>
            </div>
          )}

          {branchDiff ? (
            <div className="callout">
              <h3>Branch diff</h3>
              <p>
                Comparing <strong>current graph</strong> against branch{" "}
                <strong>{branches.find((b) => b.id === diffTargetBranchId)?.name ?? diffTargetBranchId}</strong>
              </p>
              <p>
                {branchDiff.addedNodes} added · {branchDiff.removedNodes} removed ·{" "}
                {branchDiff.modifiedNodes} modified · {branchDiff.addedEdges} edges added ·{" "}
                {branchDiff.removedEdges} edges removed
              </p>
              {branchDiff.impactedNodeIds.length > 0 ? (
                <p>
                  <strong>Impacted nodes:</strong> {branchDiff.impactedNodeIds.join(", ")}
                </p>
              ) : (
                <p>No impacted nodes — graphs are identical.</p>
              )}
              {branchDiff.nodeDiffs.filter((d) => d.kind !== "unchanged").length > 0 ? (
                <div className="branch-diff-list">
                  {branchDiff.nodeDiffs
                    .filter((d) => d.kind !== "unchanged")
                    .map((diff) => (
                      <div key={diff.nodeId} className={`diff-item diff-${diff.kind}`}>
                        <span className="diff-badge">{diff.kind.toUpperCase()}</span>
                        <span className="diff-node-name">{diff.name}</span>
                        {diff.impactedEdgeCount > 0 ? (
                          <small className="diff-impact">
                            {diff.impactedEdgeCount} edge{diff.impactedEdgeCount === 1 ? "" : "s"} affected
                          </small>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : null}
              {branchDiff.edgeDiffs.filter((d) => d.diffKind !== "unchanged").length > 0 ? (
                <div className="branch-diff-list">
                  <h4>Edge changes</h4>
                  {branchDiff.edgeDiffs
                    .filter((d) => d.diffKind !== "unchanged")
                    .map((diff, index) => (
                      <div key={`${diff.from}-${diff.to}-${index}`} className={`diff-item diff-${diff.diffKind}`}>
                        <span className="diff-badge">{diff.diffKind.toUpperCase()}</span>
                        <span className="diff-node-name">
                          {diff.from} →[{diff.edgeKind}]→ {diff.to}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
              <button onClick={() => setBranchDiff(null)} type="button">
                Clear diff
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

        <section className="workbench-main workbench-main-ide">

          {showMascotPanel ? (
            <CodeflowCatShowcase
              activeScene={activeMascotScene}
              graphPhase={graph?.phase ?? null}
              ghostCount={ghostSuggestions.length}
              unhealthy={Boolean(refactorReport && !refactorReport.isHealthy)}
              verifiedAll={allCodeNodesVerified}
            />
          ) : null}

          {graph && showPhasePanel ? (
            <div className="callout phase-progress">
              <h2>Phase progress</h2>
              <p>Current phase: {graph.phase}</p>
              <p>Spec-ready nodes: {codeBearingNodeCount}</p>
              <p>Implemented nodes: {implementedNodeCount}</p>
              <p>Verified nodes: {verifiedNodeCount}</p>
            </div>
          ) : null}

          {pendingApproval ? (
            <div className="callout danger-callout">
              <h2>Approval required</h2>
              <p>{pendingApproval.riskReport.level.toUpperCase()} risk export is waiting for approval.</p>
              <p>{pendingApproval.outputDir}</p>
              <button
                disabled={isBusy}
                onClick={() => {
                  void handleApproveAndExport();
                }}
                type="button"
              >
                {busyLabel === "Approving export" ? "Approving..." : "Approve and export"}
              </button>
            </div>
          ) : null}

          <IdeLayout
            bottomPanel={renderIdeBottomPanel()}
            explorer={<FileTree onFileSelect={(path) => handleOpenFile(path)} selectedPath={activeFile ?? undefined} />}
            floatingGraphContent={<div className="ide-floating-graph-surface">{renderGraphSurface("dark")}</div>}
            mainContent={
              activeFile ? (
                <div className="ide-editor-surface">
                  {navigationError ? (
                    <div className="callout danger-callout ide-navigation-callout">
                      <p>{navigationError}</p>
                    </div>
                  ) : null}
                  <FileTabs revealTarget={editorRevealTarget} />
                </div>
              ) : (
                renderGraphPanel()
              )
            }
            rightSidebar={renderIdeSidebar()}
          />

          {error ? <p className="error floating-error">{error}</p> : null}
        </section>

      {showMcpPanel ? (
        <aside className="floating-panel mcp-panel">
          <div className="floating-panel-header">
            <h2>MCP Clients</h2>
            <button onClick={() => setShowMcpPanel(false)} type="button">
              Close
            </button>
          </div>

          <div className="callout">
            <h3>MCP Server</h3>
            <p>Connect this node to any MCP-compatible server to invoke tools like GitHub search, Slack notifier, or a research agent.</p>
            <label className="field">
              <span>Server URL</span>
              <input
                aria-label="MCP server URL"
                onChange={(event) => setMcpServerUrl(event.target.value)}
                placeholder="http://localhost:3001/mcp"
                value={mcpServerUrl}
              />
            </label>
            <label className="field">
              <span>Headers (JSON)</span>
              <textarea
                aria-label="MCP headers JSON"
                onChange={(event) => setMcpHeadersJson(event.target.value)}
                placeholder='{"Authorization": "Bearer token"}'
                rows={3}
                value={mcpHeadersJson}
              />
            </label>
            <div className="button-row">
              <button
                disabled={isBusy || !mcpServerUrl.trim()}
                onClick={() => void handleListMcpTools()}
                type="button"
              >
                {busyLabel === "Listing MCP tools" ? "Listing..." : "List tools"}
              </button>
              {selectedNodeId ? (
                <button disabled={!mcpServerUrl.trim()} onClick={handleSaveMcpServerToNode} type="button">
                  Save to node
                </button>
              ) : null}
            </div>
          </div>

          {selectedNode?.mcpServers?.length ? (
            <div className="callout">
              <h3>Configured servers for &quot;{selectedNode.name}&quot;</h3>
              {selectedNode.mcpServers.map((server) => (
                <div key={server.serverUrl} className="mcp-server-item">
                  <p>{server.label ?? server.serverUrl}</p>
                  <div className="button-row">
                    <button onClick={() => setMcpServerUrl(server.serverUrl)} type="button">
                      Load
                    </button>
                    <button onClick={() => handleRemoveMcpServerFromNode(server.serverUrl)} type="button">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {availableMcpTools.length ? (
            <div className="callout">
              <h3>Available tools ({availableMcpTools.length})</h3>
              {availableMcpTools.map((tool) => (
                <div key={tool.name} className="mcp-tool-item">
                  <p>
                    <strong>{tool.name}</strong>
                    {tool.description ? ` — ${tool.description}` : ""}
                  </p>
                  <button onClick={() => setMcpToolName(tool.name)} type="button">
                    Select
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="callout">
            <h3>Invoke tool</h3>
            <label className="field">
              <span>Tool name</span>
              <input
                aria-label="MCP tool name"
                onChange={(event) => setMcpToolName(event.target.value)}
                placeholder="search_github"
                value={mcpToolName}
              />
            </label>
            <label className="field">
              <span>Arguments (JSON)</span>
              <textarea
                aria-label="MCP tool arguments JSON"
                onChange={(event) => setMcpToolArgsJson(event.target.value)}
                placeholder='{"query": "typescript MCP client"}'
                rows={4}
                value={mcpToolArgsJson}
              />
            </label>
            <button
              disabled={isBusy || !mcpServerUrl.trim() || !mcpToolName.trim()}
              onClick={() => void handleInvokeMcpTool()}
              type="button"
            >
              {busyLabel === "Invoking MCP tool" ? "Invoking..." : "Invoke tool"}
            </button>
          </div>

          {mcpError ? (
            <div className="callout danger-callout">
              <p>{mcpError}</p>
            </div>
          ) : null}

          {mcpInvokeResult ? (
            <div className="callout">
              <h3>Tool result</h3>
              <pre className="mcp-result">{mcpInvokeResult}</pre>
            </div>
          ) : null}
        </aside>
      ) : null}

      {legacyFloatingPanelsEnabled && showObservabilityPanel && graph ? (
        <aside className="floating-panel observability-panel">
          <div className="floating-panel-header">
            <h2>Observability Dashboard</h2>
            <button onClick={() => setShowObservabilityPanel(false)} type="button">
              Close
            </button>
          </div>

          <div className="obs-auto-row">
            <label className="choice-toggle">
              <input
                aria-label="Live polling"
                checked={autoObservability}
                onChange={(event) => setAutoObservability(event.target.checked)}
                type="checkbox"
              />
              Live polling
            </label>
            {autoObservability ? (
              <span className="obs-live-badge">● LIVE every {observabilityIntervalSecs}s</span>
            ) : (
              <button disabled={isBusy} onClick={() => void handleLoadObservability()} type="button">
                {busyLabel === "Loading observability" ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>
          {observabilityPollError ? (
            <p className="error">Polling stale: {observabilityPollError}</p>
          ) : null}
          {observabilityLastUpdatedAt ? (
            <p className="status-meta">Last updated: {new Date(observabilityLastUpdatedAt).toLocaleString()}</p>
          ) : null}

          {heatmapData ? (
            <div className="callout">
              <h3>Node Heatmap</h3>
              <p className="status-meta">Heat = 50% error rate + 35% avg latency + 15% call volume</p>
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Calls</th>
                    <th>Errors</th>
                    <th>Avg ms</th>
                    <th>Heat</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.nodes
                    .slice()
                    .sort((a, b) => b.heatIntensity - a.heatIntensity)
                    .map((metric) => (
                      <tr
                        key={metric.nodeId}
                        className={
                          metric.heatIntensity > 0.66
                            ? "heat-row-hot"
                            : metric.heatIntensity > 0.33
                              ? "heat-row-warm"
                              : ""
                        }
                      >
                        <td title={metric.nodeId}>{metric.name}</td>
                        <td>{metric.callCount}</td>
                        <td>{metric.errorCount}</td>
                        <td>{metric.avgDurationMs.toFixed(1)}</td>
                        <td>
                          <div className="heat-bar-track">
                            <div
                              className="heat-bar-fill"
                              style={{ width: `${Math.round(metric.heatIntensity * 100)}%` }}
                            />
                            <span className="heat-bar-label">{Math.round(metric.heatIntensity * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="callout">
              <p>Apply trace spans to the graph to see per-node heatmap data.</p>
              <p className="status-meta">
                Use &quot;Apply trace overlay&quot; in the graph header or enable live polling below.
              </p>
            </div>
          )}

          {latestSpans && latestSpans.length > 0 ? (
            <div className="callout">
              <h3>Recent Spans</h3>
              {latestSpans.slice(0, 10).map((span) => (
                <div key={span.spanId} className={`obs-span-row obs-span-${span.status}`}>
                  <span className="obs-span-status">{span.status.toUpperCase()}</span>
                  <span className="obs-span-name">{span.name}</span>
                  <span className="obs-span-meta">[{span.runtime} · {span.provenance ?? "observed"}]</span>
                </div>
              ))}
            </div>
          ) : null}

          {latestLogs.length > 0 ? (
            <div className="callout">
              <h3>Recent Logs</h3>
              {latestLogs.slice(0, 10).map((log) => (
                <div key={log.id} className={`obs-log-row obs-log-${log.level}`}>
                  <span className="obs-log-level">{log.level.toUpperCase()}</span>
                  <span className="obs-log-message">{log.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}

      {legacyFloatingPanelsEnabled && showVcrPanel && graph ? (
        <aside className="floating-panel vcr-panel">
          <div className="floating-panel-header">
            <div className="floating-panel-heading">
              <p className="panel-kicker">Debug Time Travel</p>
              <h2>VCR Replay</h2>
              <p className="floating-panel-copy">Scrub execution history without flooding the main graph view.</p>
            </div>
            <button onClick={() => setShowVcrPanel(false)} type="button">
              Close
            </button>
          </div>

          <p className="lead">
            Replay how data and errors propagated through the architecture graph. Load a recording from
            your observability data, then scrub through time to investigate bugs visually.
          </p>

          <div className="callout">
            <h3>Load recording</h3>
            <p className="status-meta">
              Recordings are derived from the trace spans stored in your observability snapshot.
              Ingest spans via <code>/api/observability/ingest</code> before loading.
            </p>
            <button
              disabled={isBusy}
              onClick={() => void handleLoadVcrRecording()}
              type="button"
            >
              {busyLabel === "Loading VCR recording" ? "Loading..." : "Load VCR recording"}
            </button>
            {vcrError ? (
              <p className="error">{vcrError}</p>
            ) : null}
          </div>

          {vcrRecording ? (
            <>
              <div className="panel-stat-grid">
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Frames</span>
                  <strong>{vcrRecording.frames.length}</strong>
                  <span>Replay snapshots</span>
                </div>
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Cursor</span>
                  <strong>{vcrFrameIndex + 1}</strong>
                  <span>Current frame</span>
                </div>
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Playback</span>
                  <strong>{vcrPlaying ? "Playing" : "Paused"}</strong>
                  <span>{vcrRecording.frames[vcrFrameIndex]?.status ?? "idle"}</span>
                </div>
              </div>
              <div className="callout">
                <h3>Scrub bar</h3>
                <p className="status-meta">
                  Frame {vcrFrameIndex + 1} / {vcrRecording.frames.length}
                  {vcrRecording.frames[vcrFrameIndex]?.timestamp
                    ? ` · ${new Date(vcrRecording.frames[vcrFrameIndex].timestamp!).toLocaleTimeString()}`
                    : ""}
                </p>

                <div className="vcr-scrub-row">
                  <input
                    aria-label="VCR scrub bar"
                    className="vcr-scrub-bar"
                    max={vcrRecording.frames.length - 1}
                    min={0}
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      const clamped = Math.min(
                        vcrRecording.frames.length - 1,
                        Math.max(0, raw)
                      );
                      setVcrFrameIndex(clamped);
                    }}
                    step={1}
                    type="range"
                    value={vcrFrameIndex}
                  />
                </div>

                <div className="button-row vcr-controls">
                  <button
                    aria-label="Jump to start"
                    disabled={vcrFrameIndex === 0}
                    onClick={() => {
                      setVcrPlaying(false);
                      setVcrFrameIndex(0);
                    }}
                    title="Jump to start"
                    type="button"
                  >
                    ⏮
                  </button>
                  <button
                    aria-label="Step back"
                    disabled={vcrFrameIndex === 0}
                    onClick={() => {
                      setVcrPlaying(false);
                      setVcrFrameIndex((prev) => Math.max(0, prev - 1));
                    }}
                    title="Step back"
                    type="button"
                  >
                    ◀
                  </button>
                  <button
                    aria-label={vcrPlaying ? "Pause" : "Play"}
                    onClick={() => setVcrPlaying((prev) => !prev)}
                    title={vcrPlaying ? "Pause" : "Play"}
                    type="button"
                  >
                    {vcrPlaying ? "⏸" : "▶"}
                  </button>
                  <button
                    aria-label="Step forward"
                    disabled={vcrFrameIndex >= vcrRecording.frames.length - 1}
                    onClick={() => {
                      setVcrPlaying(false);
                      setVcrFrameIndex((prev) =>
                        Math.min(vcrRecording.frames.length - 1, prev + 1)
                      );
                    }}
                    title="Step forward"
                    type="button"
                  >
                    ▶|
                  </button>
                  <button
                    aria-label="Jump to end"
                    disabled={vcrFrameIndex >= vcrRecording.frames.length - 1}
                    onClick={() => {
                      setVcrPlaying(false);
                      setVcrFrameIndex(vcrRecording.frames.length - 1);
                    }}
                    title="Jump to end"
                    type="button"
                  >
                    ⏭
                  </button>
                </div>
              </div>

              {vcrRecording.frames[vcrFrameIndex] ? (
                <div className="callout">
                  <h3>Current frame</h3>
                  <p>
                    <strong>Span:</strong> {vcrRecording.frames[vcrFrameIndex].label}
                  </p>
                  {vcrRecording.frames[vcrFrameIndex].nodeName ? (
                    <p>
                      <strong>Node:</strong> {vcrRecording.frames[vcrFrameIndex].nodeName}
                    </p>
                  ) : null}
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={`vcr-status vcr-status-${vcrRecording.frames[vcrFrameIndex].status}`}>
                      {vcrRecording.frames[vcrFrameIndex].status.toUpperCase()}
                    </span>
                  </p>
                  <p>
                    <strong>Duration:</strong> {vcrRecording.frames[vcrFrameIndex].durationMs}ms
                  </p>
                </div>
              ) : null}

              <div className="callout">
                <h3>Node states at this frame</h3>
                <table className="vcr-state-table">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>Status</th>
                      <th>Calls</th>
                      <th>Errors</th>
                      <th>Total ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graph.nodes
                      .map((node) => ({
                        node,
                        state: vcrRecording.frames[vcrFrameIndex]?.nodeStates[node.id]
                      }))
                      .filter(({ state }) => state && state.count > 0)
                      .sort((a, b) => (b.state?.count ?? 0) - (a.state?.count ?? 0))
                      .map(({ node, state }) => (
                        <tr
                          key={node.id}
                          className={`vcr-row vcr-row-${state?.status ?? "idle"}`}
                        >
                          <td title={node.id}>{node.name}</td>
                          <td>
                            <span className={`vcr-status vcr-status-${state?.status ?? "idle"}`}>
                              {(state?.status ?? "idle").toUpperCase()}
                            </span>
                          </td>
                          <td>{state?.count ?? 0}</td>
                          <td>{state?.errors ?? 0}</td>
                          <td>{state?.totalDurationMs ?? 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {graph.nodes.every(
                  (node) => !(vcrRecording.frames[vcrFrameIndex]?.nodeStates[node.id]?.count)
                ) ? (
                  <p className="status-meta">No nodes active yet at this frame.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </aside>
      ) : null}

      {legacyFloatingPanelsEnabled && showDigitalTwinPanel && graph ? (
        <aside className="floating-panel digital-twin-panel">
          <div className="floating-panel-header">
            <div className="floating-panel-heading">
              <p className="panel-kicker">Live Mirror</p>
              <h2>Digital Twin</h2>
              <p className="floating-panel-copy">Observed trace traffic plus clearly labeled simulation traffic in one live view.</p>
            </div>
            <button onClick={() => setShowDigitalTwinPanel(false)} type="button">
              Close
            </button>
          </div>

          <p className="lead">
            Reflect observed trace traffic when it exists, then use simulation to inject synthetic spans
            without mixing test traffic up with live traffic. This panel stays in preview executionMode so the
            provenance of every flow remains explicit.
          </p>

          <div className="obs-auto-row">
            <label className="choice-toggle">
              <input
                aria-label="Live Digital Twin polling"
                checked={autoDigitalTwin}
                onChange={(event) => setAutoDigitalTwin(event.target.checked)}
                type="checkbox"
              />
              Live polling
            </label>
            {autoDigitalTwin ? (
              <span className="obs-live-badge">● LIVE every 5s</span>
            ) : (
              <button disabled={isBusy} onClick={() => void handleLoadDigitalTwin()} type="button">
                {busyLabel === "Loading digital twin" ? "Loading..." : "Refresh"}
              </button>
            )}
          </div>

          <div className="callout">
            <h3>Active window</h3>
            <label className="field">
              <span>Active window (seconds)</span>
              <input
                aria-label="Active window seconds"
                min={1}
                onChange={(event) => {
                  const rawValue = Number(event.target.value);
                  if (!Number.isFinite(rawValue)) {
                    return;
                  }
                  const sanitizedValue = Math.max(1, Math.floor(rawValue));
                  setDigitalTwinWindowSecs(sanitizedValue);
                }}
                type="number"
                value={digitalTwinWindowSecs}
              />
            </label>
            <p className="status-meta">
              Nodes that received traffic within the last {digitalTwinWindowSecs}s are considered active.
            </p>
          </div>

          {digitalTwinError ? (
            <p className="error">{digitalTwinError}</p>
          ) : null}
          {digitalTwinPollError ? (
            <p className="error">Polling stale: {digitalTwinPollError}</p>
          ) : null}

          {digitalTwinSnapshot ? (
            <>
              <div className="panel-stat-grid">
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Active Nodes</span>
                  <strong>{digitalTwinSnapshot.activeNodeIds.length}</strong>
                  <span>Inside {digitalTwinWindowSecs}s window</span>
                </div>
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Traffic Sources</span>
                  <strong>{digitalTwinSnapshot.observedSpanCount} / {digitalTwinSnapshot.simulatedSpanCount}</strong>
                  <span>Observed vs simulated spans</span>
                </div>
                <div className="panel-stat-card">
                  <span className="panel-stat-label">Mode</span>
                  <strong>{autoDigitalTwin ? "Live" : "Manual"}</strong>
                  <span>{autoDigitalTwin ? "Polling every 5s" : "Refresh on demand"}</span>
                </div>
              </div>
              <div className="callout">
                <h3>Twin status</h3>
                <p className="status-meta">
                  Maturity: {digitalTwinSnapshot.maturity}. Observed flows: {digitalTwinSnapshot.observedFlowCount}. Simulated flows: {digitalTwinSnapshot.simulatedFlowCount}.
                </p>
                <p className="status-meta">
                  Last updated: {new Date(digitalTwinLastUpdatedAt ?? digitalTwinSnapshot.computedAt).toLocaleString()}
                </p>
              </div>
              <div className="callout">
                <h3>Active traffic window ({digitalTwinSnapshot.activeNodeIds.length} active nodes)</h3>
                {digitalTwinSnapshot.activeNodeIds.length > 0 ? (
                  <ul className="dt-active-list">
                    {digitalTwinSnapshot.activeNodeIds.map((nodeId) => {
                      const node = (digitalTwinGraph ?? graph).nodes.find((n) => n.id === nodeId);
                      return (
                        <li key={nodeId} className="dt-active-item">
                          <span className="dt-active-dot" />
                          <span className="dt-active-name">{node?.name ?? nodeId}</span>
                          <span className="dt-active-kind">{node?.kind}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="status-meta">No active nodes in the current window.</p>
                )}
              </div>

              <div className="callout">
                <h3>User flows ({digitalTwinSnapshot.flows.length})</h3>
                {digitalTwinSnapshot.flows.length > 0 ? (
                  <div className="dt-flows">
                    {digitalTwinSnapshot.flows.slice(0, 10).map((flow) => (
                      <div key={flow.traceId} className={`dt-flow dt-flow-${flow.status}`}>
                        <div className="dt-flow-header">
                          <span className={`dt-flow-status dt-flow-status-${flow.status}`}>
                            {flow.status.toUpperCase()}
                          </span>
                          <span className="dt-flow-name">{flow.name}</span>
                          <span className="dt-flow-meta">
                            {flow.spanCount} spans · {flow.totalDurationMs}ms · {flow.provenance}
                          </span>
                        </div>
                        <div className="dt-flow-path">
                          {flow.nodeIds.map((nodeId, idx) => {
                            const node = (digitalTwinGraph ?? graph).nodes.find((n) => n.id === nodeId);
                            return (
                              <span key={nodeId}>
                                {idx > 0 ? <span className="dt-flow-arrow">→</span> : null}
                                <span className="dt-flow-node">{node?.name ?? nodeId}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="status-meta">
                    No user flows recorded yet. Ingest trace spans via{" "}
                    <code>/api/observability/ingest</code> for observed traffic or use the simulation tool below for synthetic preview traffic.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="callout">
              <p>Click &quot;Refresh&quot; or enable live polling to load the current Digital Twin state.</p>
            </div>
          )}

          <div className="callout">
            <h3>Simulate user action</h3>
            <p className="status-meta">
              Generate synthetic traffic through specific nodes to test flows visually. Simulated spans stay labeled as
              simulated so they do not masquerade as observed production activity. Enter node IDs one per line or comma-separated.
            </p>
            <label className="field">
              <span>Node IDs</span>
              <textarea
                aria-label="Node IDs to simulate"
                onChange={(event) => setSimulateNodeIds(event.target.value)}
                placeholder={graph.nodes.slice(0, 2).map((n) => n.id).join("\n")}
                rows={3}
                style={{ fontFamily: "monospace", fontSize: "0.8rem", width: "100%" }}
                value={simulateNodeIds}
              />
            </label>
            <label className="field">
              <span>Flow label (optional)</span>
              <input
                aria-label="Simulation label"
                onChange={(event) => setSimulateLabel(event.target.value)}
                placeholder="e.g. Checkout flow"
                type="text"
                value={simulateLabel}
              />
            </label>
            <button
              disabled={isBusy || !simulateNodeIds.trim()}
              onClick={() => void handleSimulateAction()}
              type="button"
            >
              {busyLabel === "Simulating user action" ? "Simulating..." : "Run simulation"}
            </button>
          </div>
        </aside>
      ) : null}

      {legacyFloatingPanelsEnabled && showRefactorPanel && graph ? (
        <aside className="floating-panel refactor-panel">
          <div className="floating-panel-header">
            <h2>Graph Drift Repair</h2>
            <button onClick={() => setShowRefactorPanel(false)} type="button">
              Hide
            </button>
          </div>
          <p className="lead">
            Detect drift inside the blueprint graph and contract metadata, then repair the graph itself.
            This is deterministic graph healing, not source-code refactoring.
          </p>
          <p className="status-meta">
            Scope: graph only · provenance: deterministic · maturity: preview
          </p>

          <div className="button-row">
            <button
              disabled={isBusy}
              onClick={() => void handleDetectDrift()}
              type="button"
            >
              {busyLabel === "Detecting drift" ? "Detecting..." : "Detect drift"}
            </button>
            <button
              disabled={isBusy || !refactorReport || refactorReport.isHealthy}
              onClick={() => void handleHealArchitecture()}
              type="button"
            >
              {busyLabel === "Healing architecture" ? "Healing..." : "Heal graph"}
            </button>
          </div>

          {refactorError ? (
            <div className="callout">
              <p style={{ color: "var(--danger)" }}>{refactorError}</p>
            </div>
          ) : null}

          {refactorReport ? (
            <div className="callout">
              <h3>
                {refactorReport.isHealthy
                  ? "✓ Architecture is healthy"
                  : `${refactorReport.totalIssues} drift issue${refactorReport.totalIssues !== 1 ? "s" : ""} detected`}
              </h3>
              <p>Scanned at: {new Date(refactorReport.detectedAt).toLocaleString()}</p>
              <p className="status-meta">
                Scope: {refactorReport.scope} · provenance: {refactorReport.provenance} · maturity: {refactorReport.maturity}
              </p>
              {!refactorReport.isHealthy ? (
                <p>
                  Drifted nodes: {refactorReport.driftedNodeIds.length} — they are highlighted in red on the canvas.
                </p>
              ) : null}
            </div>
          ) : null}

          {refactorReport && !refactorReport.isHealthy ? (
            <div className="callout">
              <h3>Issues</h3>
              <div className="refactor-issue-list">
                {refactorReport.issues.map((issue, idx) => (
                  <div
                    key={`${issue.kind}:${issue.nodeId}:${idx}`}
                    className={`refactor-issue refactor-issue-${issue.kind}`}
                  >
                    <span className="refactor-issue-kind">{issue.kind.replace(/-/g, " ")}</span>
                    <span className="refactor-issue-desc">{issue.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {healResult ? (
            <div className="callout">
              <h3>Heal complete — {healResult.issuesFixed} fix{healResult.issuesFixed !== 1 ? "es" : ""} applied</h3>
              <p>Healed at: {new Date(healResult.healedAt).toLocaleString()}</p>
              <p className="status-meta">
                Scope: {healResult.scope} · provenance: {healResult.provenance} · maturity: {healResult.maturity}
              </p>
              <div className="refactor-heal-summary">
                {healResult.summary.map((line, idx) => (
                  <div key={idx} className="refactor-heal-line">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      {showGeneticPanel && graph ? (
        <aside className="floating-panel genetic-panel">
          <div className="floating-panel-header">
            <h2>Genetic Evolution</h2>
            <button onClick={() => setShowGeneticPanel(false)} type="button">
              Close
            </button>
          </div>

          <p className="lead">
            Run a heuristic architecture tournament across monolith, microservices, and serverless
            variants. Use the scores as decision support, not as benchmarked production truth.
          </p>
          <p className="status-meta">Provenance: heuristic · maturity: experimental</p>

          <div className="callout">
            <h3>Tournament settings</h3>
            <label className="field">
              <span>Generations</span>
              <input
                aria-label="Number of generations"
                min={1}
                max={10}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (Number.isFinite(v)) setGeneticGenerations(Math.max(1, Math.min(10, Math.floor(v))));
                }}
                type="number"
                value={geneticGenerations}
              />
            </label>
            <label className="field">
              <span>Population size</span>
              <input
                aria-label="Population size"
                min={3}
                max={12}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (Number.isFinite(v)) setGeneticPopulationSize(Math.max(3, Math.min(12, Math.floor(v))));
                }}
                type="number"
                value={geneticPopulationSize}
              />
            </label>
            <button
              disabled={isBusy}
              onClick={() => void handleRunGeneticEvolution()}
              type="button"
            >
              {busyLabel === "Running genetic evolution" ? "Evolving..." : "Run tournament"}
            </button>
          </div>

          {geneticError ? (
            <p className="error">{geneticError}</p>
          ) : null}

          {tournamentResult ? (
            (() => {
              const winner = tournamentResult.variants.find((v) => v.id === tournamentResult.winnerId);
              return (
                <>
                  <div className="callout">
                    <h3><span aria-hidden="true">🏆</span> Winner: {winner?.style}</h3>
                    <p className="status-meta">{tournamentResult.summary}</p>
                    <p className="status-meta">
                      {tournamentResult.generationCount} generation{tournamentResult.generationCount !== 1 ? "s" : ""} · {tournamentResult.populationSize} variants · evolved {new Date(tournamentResult.evolvedAt).toLocaleTimeString()}
                    </p>
                    <p className="status-meta">
                      Provenance: {tournamentResult.provenance} · maturity: {tournamentResult.maturity}
                    </p>
                  </div>

                  <div className="callout">
                    <h3>All variants ({tournamentResult.variants.length})</h3>
                    <div className="genetic-variants">
                      {tournamentResult.variants.map((variant) => {
                        const isWinner = variant.id === tournamentResult.winnerId;
                        return (
                          <div
                            key={variant.id}
                            className={`genetic-variant${isWinner ? " genetic-variant-winner" : ""}`}
                          >
                            <div className="genetic-variant-header">
                              <span className="genetic-variant-rank">#{variant.rank}</span>
                              <span className="genetic-variant-style">{variant.style}</span>
                              {isWinner ? <span className="genetic-winner-badge"><span aria-hidden="true">🏆</span> Winner</span> : null}
                              <span className="genetic-variant-fitness">Fitness: {variant.benchmark.fitness}</span>
                            </div>
                            <div className="genetic-variant-graph-info">
                              {variant.graph.nodes.length} nodes · {variant.graph.edges.length} edges
                              {" · "}gen {variant.generation}
                              {" · "}{variant.provenance}
                              {" · "}{variant.maturity}
                            </div>
                            <div className="genetic-benchmark-scores">
                              <span
                                title="Scalability"
                                aria-label={`Scalability score ${variant.benchmark.scalability}`}
                              >
                                <span aria-hidden="true">📈</span> {variant.benchmark.scalability}
                              </span>
                              <span
                                title="Cost efficiency"
                                aria-label={`Cost efficiency score ${variant.benchmark.estimatedCostScore}`}
                              >
                                <span aria-hidden="true">💰</span> {variant.benchmark.estimatedCostScore}
                              </span>
                              <span
                                title="Performance"
                                aria-label={`Performance score ${variant.benchmark.performance}`}
                              >
                                <span aria-hidden="true">⚡</span> {variant.benchmark.performance}
                              </span>
                              <span
                                title="Maintainability"
                                aria-label={`Maintainability score ${variant.benchmark.maintainability}`}
                              >
                                <span aria-hidden="true">🔧</span> {variant.benchmark.maintainability}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="callout">
              <p>Click &quot;Run tournament&quot; to evolve and benchmark architecture variants.</p>
            </div>
          )}
        </aside>
      ) : null}

      {showInspector && (selectedNode || (drilldownRootNode && selectedDetailItem)) ? (
        <aside className="floating-panel inspector-panel">
          <div className="floating-panel-header">
            <div className="floating-panel-heading">
              <p className="panel-kicker">Selection</p>
              <h2>Inspector</h2>
              <p className="floating-panel-copy">Edit the selected node without letting the side panel sprawl.</p>
            </div>
            <button onClick={() => setShowInspector(false)} type="button">
              Close
            </button>
          </div>

          {session ? (
            <div className="callout">
              <p>Session: {session.sessionId}</p>
              <p>Updated: {session.updatedAt}</p>
              <p>Approvals: {session.approvalIds.length}</p>
            </div>
          ) : null}

          {runPlan ? (
            <div className="callout">
              <h3>Execution plan</h3>
              {runPlan.warnings.length
                ? runPlan.warnings.map((warning) => <p key={warning}>{warning}</p>)
                : null}
              {runPlan.tasks.slice(0, 8).map((task) => (
                <p key={task.id}>
                  Batch {task.batchIndex + 1}: {task.title}
                </p>
              ))}
            </div>
          ) : null}

          {executionResult ? (
            <div className="callout">
              <h3>Execution output</h3>
              <p>Status: {executionResult.success ? "success" : "failure"}</p>
              <p>Exit code: {executionResult.exitCode ?? "N/A"}</p>
              <p>Duration: {executionResult.durationMs}ms</p>
              {executionResult.executedPath ? <p>{executionResult.executedPath}</p> : null}
              {executionSummary ? (
                <p>
                  {executionSummary.passed} passed · {executionSummary.warning} warning · {executionSummary.failed} failed · {executionSummary.blocked} blocked · {executionSummary.skipped} skipped
                </p>
              ) : null}
              {executionResult.runId ? <p>Run ID: {executionResult.runId}</p> : null}
              {executionResult.entryNodeId ? <p>Entry node: {executionResult.entryNodeId}</p> : null}
              {executionResult.testResults.length ? <p>{executionResult.testResults.length} generated test results recorded.</p> : null}
              {failedExecutionStep ? <p>First failure: {failedExecutionStep.message}</p> : null}
              {!failedExecutionStep && blockedExecutionStep ? <p>First block: {blockedExecutionStep.message}</p> : null}
              {executionResult.stdout ? <pre>{executionResult.stdout}</pre> : null}
              {executionResult.stderr ? <pre>{executionResult.stderr}</pre> : null}
            </div>
          ) : null}

          {latestSpans?.length || latestLogs.length ? (
            <div className="callout">
            <h3>Observability</h3>
            {latestSpans?.slice(0, 5).map((span) => (
              <p key={span.spanId}>
                {span.status.toUpperCase()} {span.name} [{span.runtime}]
              </p>
            ))}
            {latestLogs.slice(0, 5).map((log) => (
              <p key={log.id}>
                {log.level.toUpperCase()} {log.message}
              </p>
            ))}
            </div>
          ) : null}

          {drilldownRootNode && selectedDetailItem ? (
            <>
            <div className="callout inspector-hero-card">
              <p className="node-tag">{selectedDetailItem.kind}</p>
              <h3>{selectedDetailItem.label}</h3>
              <p>{selectedDetailItem.summary}</p>
              {selectedDetailItem.signature ? <p>Signature: {selectedDetailItem.signature}</p> : null}
              {selectedDetailItem.path ? <p>Path: {selectedDetailItem.path}</p> : null}
              {selectedDetailItem.drilldownNodeId ? <p>Double-click this node in the graph to open its internal structure.</p> : null}
            </div>
            {selectedDetailItem.sections.length
              ? selectedDetailItem.sections.map((section) => renderSection(section.title, section.items))
              : renderSection("Details", ["No further documentation available for this node."])}
            {renderCodeEditorPanel()}
            </>
          ) : selectedNode && graph ? (
            <>
            {(() => {
              const contract = normalizeContract(selectedNode.contract);

              return (
                <>
                  <div className="inspector-hero-card">
                    <p className="node-tag">{selectedNode.kind}</p>
                    <h3>{selectedNode.name}</h3>
                    <div className="panel-stat-grid inspector-stat-grid">
                      <div className="panel-stat-card">
                        <span className="panel-stat-label">Phase</span>
                        <strong>{graph.phase}</strong>
                        <span>Status {selectedNode.status}</span>
                      </div>
                      <div className="panel-stat-card">
                        <span className="panel-stat-label">Contract</span>
                        <strong>{contract.methods.length + contract.attributes.length}</strong>
                        <span>{contract.inputs.length} inputs · {contract.outputs.length} outputs</span>
                      </div>
                      <div className="panel-stat-card">
                        <span className="panel-stat-label">Runtime</span>
                        <strong>{selectedNode.traceState?.status ?? "idle"}</strong>
                        <span>{selectedNode.mcpServers?.length ?? 0} MCP servers</span>
                      </div>
                    </div>
                  </div>
                  <label className="field">
                    <span>Summary</span>
                    <textarea
                      value={selectedNode.summary}
                      onChange={(event) =>
                        setGraph(
                          updateNode(graph, selectedNode.id, (node) => ({
                            ...node,
                            summary: event.target.value,
                            contract: {
                              ...node.contract,
                              summary: event.target.value
                            }
                          }))
                        )
                      }
                      rows={5}
                    />
                  </label>

                  <label className="field">
                    <span>Notes (one per line)</span>
                    <textarea
                      value={contract.notes.join("\n")}
                      onChange={(event) =>
                        setGraph(
                          updateNode(graph, selectedNode.id, (node) => ({
                            ...node,
                            contract: {
                              ...node.contract,
                              notes: event.target.value
                                .split(/\r?\n/)
                                .map((line) => line.trim())
                                .filter(Boolean)
                            }
                          }))
                        )
                      }
                      rows={8}
                    />
                  </label>

                  <div className="callout">
                    <h3>Node details</h3>
                    <p>Phase: {graph.phase}</p>
                    <p>Status: {selectedNode.status}</p>
                    <p>Signature: {selectedNode.signature ?? "N/A"}</p>
                    <p>Path: {selectedNode.path ?? "N/A"}</p>
                    <p>Inputs: {contract.inputs.length}</p>
                    <p>Outputs: {contract.outputs.length}</p>
                    <p>Attributes: {contract.attributes.length}</p>
                    <p>Methods: {contract.methods.length}</p>
                    <p>Calls: {contract.calls.length}</p>
                    <p>Errors: {contract.errors.length}</p>
                    <p>Trace status: {selectedNode.traceState?.status ?? "idle"}</p>
                    <p>MCP servers: {selectedNode.mcpServers?.length ?? 0}</p>
                    {selectedNode.lastVerification ? (
                      <>
                        <p>Last verification: {selectedNode.lastVerification.status}</p>
                        {selectedNode.lastVerification.stdout ? <pre>{selectedNode.lastVerification.stdout}</pre> : null}
                        {selectedNode.lastVerification.stderr ? <pre>{selectedNode.lastVerification.stderr}</pre> : null}
                      </>
                    ) : null}
                    <p>Double-click the node in the graph to open its internal structure.</p>
                  </div>

                  {renderBlueprintNodeDocumentation(selectedNode)}
                  {renderNodeRuntimeEvidence(selectedNode)}

                  {activeCodeNode ? (
                    renderCodeEditorPanel()
                  ) : (
                    <div className="callout">
                      <h3>Code generation scope</h3>
                      <p>
                        Module nodes stay architectural. Drill into the owned functions, classes, APIs,
                        or screens to edit generated code.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setGraph(deleteNodeFromGraph(graph, selectedNode.id));
                      setSelectedNodeId(null);
                      setShowInspector(false);
                    }}
                    type="button"
                  >
                    Delete selected node
                  </button>
                </>
              );
            })()}
            </>
          ) : (
            <p>Select a node in the graph to inspect and edit it.</p>
          )}
      </aside>
    ) : null}
    </div>
  );
}
