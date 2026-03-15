"use client";

import { z } from "zod";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { GraphCanvas } from "@/components/graph-canvas";
import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import { addEdgeToGraph, addNodeToGraph, deleteNodeFromGraph } from "@/lib/blueprint/edit";
import { buildDetailFlow } from "@/lib/blueprint/flow-view";
import { computeHeatmap } from "@/lib/blueprint/heatmap";
import type { HeatmapData } from "@/lib/blueprint/heatmap";
import { canEnterImplementationPhase, canEnterIntegrationPhase, setGraphPhase } from "@/lib/blueprint/phases";
import { applyTraceOverlay } from "@/lib/blueprint/traces";
import { frameIndexToPosition, positionToFrameIndex, replayAtFrame } from "@/lib/blueprint/vcr";
import type { CycleReport } from "@/lib/blueprint/cycles";
import type { SmellReport } from "@/lib/blueprint/smells";
import type { GraphMetrics } from "@/lib/blueprint/metrics";
import type {
  ApprovalRecord,
  BlueprintGraph,
  BlueprintNode,
  BranchDiff,
  ConflictReport,
  DigitalTwinSnapshot,
  ExecutionMode,
  ExportResult,
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
  latestSpans?: Array<{ spanId: string; name: string; status: string; runtime: string }>;
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

type StatusTone = "info" | "success" | "danger";

const tracesSchema = z.array(traceSpanSchema);

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
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

export function BlueprintWorkbench() {
  const MIN_OBSERVABILITY_INTERVAL_SECS = 2;
  const [projectName, setProjectName] = useState("CodeFlow Workspace");
  const [repoPath, setRepoPath] = useState("");
  const [prdText, setPrdText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [nvidiaApiKey, setNvidiaApiKey] = useState("");
  const [mode, setMode] = useState<ExecutionMode>("essential");
  const [outputDir, setOutputDir] = useState("");
  const [traceInput, setTraceInput] = useState("");
  const [runInput, setRunInput] = useState("{}");
  const [graph, setGraph] = useState<BlueprintGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [showObservabilityPanel, setShowObservabilityPanel] = useState(false);
  const [autoObservability, setAutoObservability] = useState(false);
  const [observabilityIntervalSecs, setObservabilityIntervalSecs] = useState(5);
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

  // ── Architectural Genetic Algorithms ──────────────────────────────────────
  const [showGeneticPanel, setShowGeneticPanel] = useState(false);
  const [geneticGenerations, setGeneticGenerations] = useState(3);
  const [geneticPopulationSize, setGeneticPopulationSize] = useState(6);
  const [tournamentResult, setTournamentResult] = useState<TournamentResult | null>(null);
  const [geneticError, setGeneticError] = useState<string | null>(null);

  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const drilldownNodeId = drilldownStack.at(-1) ?? null;
  const drilldownRootNode = graph?.nodes.find((node) => node.id === drilldownNodeId) ?? null;
  const detailFlow =
    graph && drilldownNodeId
      ? buildDetailFlow(graph, drilldownNodeId, selectedDetailNodeId ?? undefined)
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
  const canStartImplementation = graph ? canEnterImplementationPhase(graph) : false;
  const canStartIntegration = graph ? canEnterIntegrationPhase(graph) : false;
  const canImplementActiveNode = Boolean(activeCodeNode && graph?.phase === "implementation");
  const canRunActiveNode = Boolean(
    activeCodeNode &&
      graph?.phase === "implementation" &&
      ["implemented", "verified", "connected"].includes(activeCodeNode.status ?? "spec_only")
  );
  const canRunIntegration = Boolean(graph?.phase === "integration");
  const apiKeyStatus = nvidiaApiKey.trim()
    ? `Browser key saved (${maskApiKey(nvidiaApiKey)}).`
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
  }, [drilldownNodeId, graph, selectedNodeId]);

  useEffect(() => {
    const storedApiKey = localStorage.getItem("nvidia_api_key");
    if (storedApiKey) {
      setNvidiaApiKey(storedApiKey);
    }

    const storedCompletionPreference = localStorage.getItem("codeflow_live_completions");
    if (storedCompletionPreference) {
      setLiveCompletionsEnabled(storedCompletionPreference === "true");
    }

    const storedAutoImplement = localStorage.getItem("codeflow_auto_implement");
    if (storedAutoImplement) {
      setAutoImplementNodes(storedAutoImplement === "true");
    }
  }, []);

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
    if (nvidiaApiKey.trim()) {
      localStorage.setItem("nvidia_api_key", nvidiaApiKey);
    } else {
      localStorage.removeItem("nvidia_api_key");
    }
  }, [nvidiaApiKey]);

  useEffect(() => {
    localStorage.setItem("codeflow_live_completions", String(liveCompletionsEnabled));
  }, [liveCompletionsEnabled]);

  useEffect(() => {
    localStorage.setItem("codeflow_auto_implement", String(autoImplementNodes));
  }, [autoImplementNodes]);

  useEffect(() => {
    if (!isBuilding) {
      return;
    }

    const messages = useAI
      ? [
          "Sending your prompt to NVIDIA.",
          "Waiting for the model response. This can take a bit for larger prompts.",
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

  // Clear VCR state when the panel is closed.
  useEffect(() => {
    if (!showVcrPanel) {
      setVcrGraph(null);
      setVcrPlaying(false);
      setVcrRecording(null);
      setVcrFrameIndex(0);
      setVcrError(null);
    }
  }, [showVcrPanel]);

  // Clear Digital Twin state when the panel is closed.
  useEffect(() => {
    if (!showDigitalTwinPanel) {
      setDigitalTwinSnapshot(null);
      setDigitalTwinGraph(null);
      setDigitalTwinError(null);
    }
  }, [showDigitalTwinPanel]);

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
    } catch {
      // silently ignore poll errors to avoid flooding the UI
    }
  }, [projectName]);

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
    } catch {
      // silently ignore poll errors
    }
  }, [projectName, digitalTwinWindowSecs]);

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
    } catch (caughtError) {
      setDigitalTwinError(
        caughtError instanceof Error ? caughtError.message : "Failed to load digital twin."
      );
    } finally {
      setBusyLabel(null);
    }
  }, [projectName, digitalTwinWindowSecs]);

  const handleSimulateAction = useCallback(async () => {
    if (!projectName.trim() || !simulateNodeIds.trim()) return;
    setBusyLabel("Simulating user action");
    setDigitalTwinError(null);

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
      setDigitalTwinError(
        caughtError instanceof Error ? caughtError.message : "Failed to simulate user action."
      );
    } finally {
      setBusyLabel(null);
    }
  }, [projectName, simulateNodeIds, simulateLabel, handleLoadDigitalTwin]);

  // ── Genetic Evolution handler ─────────────────────────────────────────────
  const handleRunGeneticEvolution = useCallback(async () => {
    if (!graph) return;
    setBusyLabel("Running genetic evolution");
    setGeneticError(null);
    try {
      const response = await fetch("/api/genetic/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            mode,
            nvidiaApiKey: nvidiaApiKey.trim() || undefined
          }
        : {
            projectName,
            repoPath: repoPath.trim() || undefined,
            prdText: prdText.trim() || undefined,
            mode
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
      const message = caughtError instanceof Error ? caughtError.message : "Failed to build blueprint.";
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
    } catch (caughtError) {
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to export artifacts.");
    } finally {
      setBusyLabel(null);
    }
  };

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
    } catch (caughtError) {
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

    try {
      const response = await fetch("/api/executions/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          targetNodeId,
          input: runInput,
          codeDrafts: Object.keys(codeDrafts).length ? codeDrafts : undefined
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
        setStatusDetail(`Exit code ${body.result.exitCode ?? 0} in ${body.result.durationMs}ms.`);
      } else {
        setStatusTone("danger");
        setStatusTitle("Execution failed");
        setStatusDetail(body.result.stderr || body.result.error || "Unknown execution failure.");
      }
    } catch (caughtError) {
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load observability.");
    } finally {
      setBusyLabel(null);
    }
  };

  const handleAnalyzeConflicts = async () => {
    if (!graph || !repoPath.trim()) {
      setError("Build a blueprint and provide a repo path before analyzing conflicts.");
      return;
    }

    setBusyLabel("Analyzing conflicts");
    setError(null);

    try {
      const response = await fetch("/api/conflicts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graph,
          repoPath: repoPath.trim()
        })
      });
      const body = (await response.json()) as ConflictResponse;

      if (!response.ok || !body.report) {
        throw new Error(body.error || "Failed to analyze conflicts.");
      }

      setConflictReport(body.report);
    } catch (caughtError) {
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

  const handleGraphSelect = (nodeId: string) => {
    setShowInspector(true);
    if (drilldownRootNode) {
      setSelectedDetailNodeId(nodeId);
      return;
    }

    setSelectedNodeId(nodeId);
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
    // Clear stale results from any prior run so the panel always reflects the
    // current analysis and not leftover data from a failed/partial run.
    setCycleReport(null);
    setSmellReport(null);
    setGraphMetrics(null);
    setMermaidDiagram(null);
    setShowAnalysisPanel(true);

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
    } catch (caughtError) {
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
    } catch {
      // silently ignore load errors
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
        setBranches((current) => [...current, body.branch]);
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
      }
    } catch (caughtError) {
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

    if (ghost.suggestedEdge) {
      const fromExists = nextGraph.nodes.some((n) => n.id === ghost.suggestedEdge.from);
      if (fromExists && targetNodeId) {
        nextGraph = addEdgeToGraph(nextGraph, {
          from: ghost.suggestedEdge.from,
          to: targetNodeId,
          kind: ghost.suggestedEdge.kind
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
    } catch {
      // silently ignore
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

  return (
    <div className="workbench-shell">
      <header className="workbench-topbar">
        <div className="topbar-start">
          <div className="brand-lockup">
            <p className="brand-eyebrow">CodeFlow</p>
            <h1>Blueprint Studio</h1>
          </div>
          <button onClick={() => setShowSettings((current) => !current)} type="button">
            Settings
          </button>
          <button onClick={() => setShowPromptPanel((current) => !current)} type="button">
            {showPromptPanel ? "Hide prompt" : "Prompt"}
          </button>
          {graph ? (
            <button onClick={() => setShowEditPanel((current) => !current)} type="button">
              {showEditPanel ? "Hide edit" : "Edit graph"}
            </button>
          ) : null}
          {graph ? (
            <button
              onClick={() => {
                setShowBranchPanel((current) => !current);
                if (!showBranchPanel) {
                  void handleLoadBranches();
                }
              }}
              type="button"
            >
              {showBranchPanel ? "Hide branches" : `Branches${branches.length ? ` (${branches.length})` : ""}`}
            </button>
          ) : null}
        </div>
        <div className="topbar-center">
          <button disabled={isBusy} onClick={handleBuild} type="button">
            {busyLabel === "Building blueprint" ? "Building..." : "Build blueprint"}
          </button>
          <button disabled={isBusy || !canStartImplementation} onClick={() => void handleAdvanceToImplementation()} type="button">
            {busyLabel === "Auto-implementing nodes" ? "Implementing..." : "Enter Phase 2"}
          </button>
          <button disabled={isBusy || !canRunActiveNode} onClick={() => void handleRunExecution()} type="button">
            {busyLabel === "Running node" ? "Running..." : "Run node"}
          </button>
          <button disabled={isBusy || !canStartIntegration} onClick={handleAdvanceToIntegration} type="button">
            Enter Phase 3
          </button>
          <button disabled={isBusy || !canRunIntegration} onClick={() => void handleRunExecution()} type="button">
            {busyLabel === "Running integration" ? "Running..." : "Run integration"}
          </button>
          <button disabled={isBusy} onClick={() => void handleExport()} type="button">
            {busyLabel === "Exporting artifacts" ? "Exporting..." : "Export"}
          </button>
          <button disabled={isBusy || !graph} onClick={() => void handleRunAnalysis()} type="button">
            {busyLabel === "Analyzing architecture" ? "Analyzing..." : "Analyze"}
          </button>
          <button disabled={isBusy || !graph} onClick={() => void handleSuggestGhostNodes()} type="button">
            {busyLabel === "Suggesting ghost nodes" ? "Suggesting..." : "Suggest nodes"}
          </button>
          {ghostSuggestions.length > 0 ? (
            <button onClick={() => setGhostSuggestions([])} type="button">
              Clear ghosts ({ghostSuggestions.length})
            </button>
          ) : null}
          <button disabled={!graph} onClick={() => setShowMcpPanel((current) => !current)} type="button">
            {showMcpPanel ? "Hide MCP" : "MCP"}
          </button>
          {graph ? (
            <button onClick={() => setShowObservabilityPanel((current) => !current)} type="button">
              {showObservabilityPanel ? "Hide heatmap" : "Heatmap"}
            </button>
          ) : null}
          {graph ? (
            <button
              onClick={() => {
                setShowVcrPanel((current) => !current);
              }}
              type="button"
            >
              {showVcrPanel ? "Hide VCR" : "VCR Replay"}
            </button>
          ) : null}
          {graph ? (
            <button
              onClick={() => {
                setShowDigitalTwinPanel((current) => !current);
              }}
              type="button"
            >
              {showDigitalTwinPanel ? "Hide Digital Twin" : "Digital Twin"}
            </button>
          ) : null}
          {graph ? (
            <button
              onClick={() => setShowGeneticPanel((current) => !current)}
              type="button"
            >
              {showGeneticPanel ? "Hide Evolution" : "Genetic Evolution"}
            </button>
          ) : null}
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
            <span>Execution mode</span>
            <div className="choice-row">
              <label>
                <input checked={mode === "essential"} onChange={() => setMode("essential")} type="radio" name="mode" />
                Essential
              </label>
              <label>
                <input checked={mode === "yolo"} onChange={() => setMode("yolo")} type="radio" name="mode" />
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

      {showPromptPanel ? (
        <section className="floating-panel prompt-panel">
          <div className="floating-panel-header">
            <h2>Blueprint input</h2>
            <button onClick={() => setShowPromptPanel(false)} type="button">
              Hide
            </button>
          </div>
          <p className="lead">
            Build your structure once, then keep the canvas clean while you implement and verify nodes.
          </p>
          {useAI ? (
            <label className="field">
              <span>Describe your project</span>
              <textarea
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                rows={8}
                placeholder="A task management app with a React frontend and Node backend. Or a Rails monolith, a Django app, a Go service, a Swift iOS client, or any other stack you want to visualize."
              />
              <small>
                AI prompt mode is stack-agnostic. Legacy repo analysis currently reads JavaScript
                and TypeScript repos. Exported starter stubs are TS/TSX today.
              </small>
            </label>
          ) : (
            <>
              <label className="field">
                <span>Repo path</span>
                <input
                  value={repoPath}
                  onChange={(event) => setRepoPath(event.target.value)}
                  placeholder="/absolute/path/to/repo"
                />
              </label>
              <label className="field">
                <span>PRD markdown</span>
                <textarea
                  aria-label="PRD markdown"
                  value={prdText}
                  onChange={(event) => setPrdText(event.target.value)}
                  rows={10}
                  placeholder="# UI&#10;- Screen: Workspace&#10;&#10;# API&#10;- POST /api/blueprint"
                />
              </label>
            </>
          )}
        </section>
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

        <section className="workbench-main">
        <div className="graph-mode-strip">
          <span className="mode-pill">Phase {graph?.phase ?? "spec"}</span>
          <span className="mode-pill">{useAI ? "AI blueprint" : "Repo blueprint"}</span>
          <span className="mode-pill">{mode}</span>
          {autoImplementNodes ? <span className="mode-pill accent-pill">Auto implement on</span> : null}
        </div>
        <div
          aria-live={statusTone === "danger" ? "assertive" : "polite"}
          className={`callout status-callout floating-status ${statusTone === "danger" ? "danger-callout" : statusTone === "success" ? "success-callout" : "info-callout"}`}
          role="status"
        >
          <h2>{statusTitle}</h2>
          <p>{statusDetail}</p>
          <p className="status-meta">
            {useAI
              ? `API key status: ${apiKeyStatus}`
              : "Legacy mode analyzes PRD input plus JavaScript/TypeScript repos."}
          </p>
        </div>

        {graph ? (
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
              <button disabled={isBusy} onClick={handleApplyTraces} type="button">
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

          <GraphCanvas
            graph={vcrGraph ?? graph}
            selectedNodeId={drilldownRootNode ? selectedDetailNodeId : selectedNodeId}
            nodes={detailFlow?.nodes}
            edges={detailFlow?.edges}
            onNodeDoubleClick={handleGraphDoubleClick}
            onSelect={handleGraphSelect}
            ghostNodes={drilldownRootNode ? undefined : ghostSuggestions}
            onGhostNodeClick={handleSolidifyGhostNode}
            heatmapData={drilldownRootNode ? undefined : heatmapData}
          />
        </section>

        {error ? <p className="error floating-error">{error}</p> : null}

        <div className="floating-lower-stack">
          {exportResult ? (
            <div className="callout">
            <h2>Exported</h2>
            <p>{exportResult.rootDir}</p>
            <p>{exportResult.blueprintPath}</p>
            <p>{exportResult.docsDir}</p>
            <p>{exportResult.stubsDir}</p>
            <p>{exportResult.canvasPath}</p>
            {exportResult.checkpointDir ? <p>{exportResult.checkpointDir}</p> : null}
            </div>
          ) : null}

          {riskReport ? (
            <div className="callout">
            <h2>Risk report</h2>
            <p>
              {riskReport.level.toUpperCase()} ({riskReport.score})
            </p>
            {riskReport.factors.length ? (
              riskReport.factors.map((factor) => <p key={factor.code}>{factor.message}</p>)
            ) : (
              <p>No notable export risks detected.</p>
            )}
            </div>
          ) : null}

          {conflictReport ? (
            <div className="callout">
            <h2>Drift report</h2>
            <p>{conflictReport.conflicts.length} conflicts</p>
            {conflictReport.conflicts.slice(0, 6).map((conflict) => (
              <p key={`${conflict.kind}:${conflict.message}`}>{conflict.message}</p>
            ))}
            </div>
          ) : null}
        </div>
      </section>

      {showAnalysisPanel && graph ? (
        <aside className="floating-panel analysis-panel">
          <div className="floating-panel-header">
            <h2>Architecture Analysis</h2>
            <button onClick={() => setShowAnalysisPanel(false)} type="button">
              Close
            </button>
          </div>

          {graphMetrics ? (
            <div className="callout">
              <h3>Graph Metrics</h3>
              <p>Nodes: {graphMetrics.nodeCount} · Edges: {graphMetrics.edgeCount}</p>
              <p>Density: {graphMetrics.density.toFixed(3)} · Avg degree: {graphMetrics.avgDegree.toFixed(1)}</p>
              <p>Connected components: {graphMetrics.connectedComponents} · Isolated: {graphMetrics.isolatedNodes} · Leaf: {graphMetrics.leafNodes}</p>
              <p>Total methods: {graphMetrics.totalMethods} · Avg/node: {graphMetrics.avgMethodsPerNode.toFixed(1)}</p>
              <p>Total responsibilities: {graphMetrics.totalResponsibilities} · Avg/node: {graphMetrics.avgResponsibilitiesPerNode.toFixed(1)}</p>
              {graphMetrics.maxInDegreeNodeId ? <p>Most depended-on: {graphMetrics.maxInDegreeNodeId} (in-degree {graphMetrics.maxInDegree})</p> : null}
              {graphMetrics.maxOutDegreeNodeId ? <p>Most dependent: {graphMetrics.maxOutDegreeNodeId} (out-degree {graphMetrics.maxOutDegree})</p> : null}
              <h4>Nodes by kind</h4>
              {Object.entries(graphMetrics.nodesByKind).map(([kind, count]) => (
                <p key={kind}>{kind}: {count}</p>
              ))}
              <h4>Edges by kind</h4>
              {Object.entries(graphMetrics.edgesByKind).map(([kind, count]) => (
                <p key={kind}>{kind}: {count}</p>
              ))}
            </div>
          ) : null}

          {smellReport ? (
            <div className="callout">
              <h3>Architecture Health: {smellReport.healthScore}/100</h3>
              <p>{smellReport.totalSmells} smell{smellReport.totalSmells === 1 ? "" : "s"} detected</p>
              {smellReport.smells.map((smell, index) => (
                <div key={`${smell.code}:${smell.nodeId ?? "global"}:${index}`} className="smell-item">
                  <p>
                    <strong>{smell.severity.toUpperCase()}</strong> [{smell.code}]{smell.nodeId ? ` — ${smell.nodeId}` : ""}
                  </p>
                  <p>{smell.message}</p>
                  <p><em>{smell.suggestion}</em></p>
                </div>
              ))}
              {smellReport.totalSmells === 0 ? <p>No architecture smells detected. Clean design!</p> : null}
            </div>
          ) : null}

          {cycleReport ? (
            <div className="callout">
              <h3>Dependency Cycles</h3>
              <p>{cycleReport.totalCycles} cycle{cycleReport.totalCycles === 1 ? "" : "s"} detected</p>
              {cycleReport.totalCycles > 0 ? (
                <>
                  <p>Max cycle length: {cycleReport.maxCycleLength}</p>
                  <p>Affected nodes: {cycleReport.affectedNodeIds.join(", ")}</p>
                  {cycleReport.cycles.map((cycle, index) => (
                    <div key={cycle.nodeIds.join(",")} className="cycle-item">
                      <p><strong>Cycle {index + 1}</strong>: {cycle.nodeIds.join(" → ")}</p>
                      {cycle.edges.map((edge, edgeIndex) => (
                        <p key={`${edge.from}→${edge.to}:${edge.kind}:${edgeIndex}`}>  {edge.from} —[{edge.kind}]→ {edge.to}</p>
                      ))}
                    </div>
                  ))}
                </>
              ) : (
                <p>No dependency cycles found. Graph is a clean DAG!</p>
              )}
            </div>
          ) : null}

          {mermaidDiagram ? (
            <div className="callout">
              <h3>Mermaid Diagram</h3>
              <p>Copy the code below into any Mermaid-compatible renderer (GitHub, Obsidian, Notion, etc.)</p>
              <pre className="mermaid-output">{mermaidDiagram}</pre>
            </div>
          ) : null}

          {!graphMetrics && !smellReport && !cycleReport && !mermaidDiagram ? (
            <div className="callout">
              <p>Click &quot;Analyze&quot; in the toolbar to run architecture analysis.</p>
            </div>
          ) : null}
        </aside>
      ) : null}

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

      {showObservabilityPanel && graph ? (
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
                  <span className="obs-span-meta">[{span.runtime}]</span>
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

      {showVcrPanel && graph ? (
        <aside className="floating-panel vcr-panel">
          <div className="floating-panel-header">
            <h2>VCR Replay</h2>
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
                    onClick={() => setVcrPlaying((prev) => !prev)}
                    title={vcrPlaying ? "Pause" : "Play"}
                    type="button"
                  >
                    {vcrPlaying ? "⏸" : "▶"}
                  </button>
                  <button
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

      {showDigitalTwinPanel && graph ? (
        <aside className="floating-panel digital-twin-panel">
          <div className="floating-panel-header">
            <h2>Digital Twin</h2>
            <button onClick={() => setShowDigitalTwinPanel(false)} type="button">
              Close
            </button>
          </div>

          <p className="lead">
            Mirror your running production system. Active nodes light up in real-time as live users
            interact with the deployed app. Use simulation to inject test traffic and trace the flow
            through your architecture.
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

          {digitalTwinSnapshot ? (
            <>
              <div className="callout">
                <h3>Live traffic ({digitalTwinSnapshot.activeNodeIds.length} active nodes)</h3>
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
                          <span className="dt-flow-meta">{flow.spanCount} spans · {flow.totalDurationMs}ms</span>
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
                    <code>/api/observability/ingest</code> or use the simulation tool below.
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
              Generate synthetic traffic through specific nodes to test flows visually.
              Enter node IDs (one per line or comma-separated).
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

      {showGeneticPanel && graph ? (
        <aside className="floating-panel genetic-panel">
          <div className="floating-panel-header">
            <h2>Genetic Evolution</h2>
            <button onClick={() => setShowGeneticPanel(false)} type="button">
              Close
            </button>
          </div>

          <p className="lead">
            Generate, benchmark, and evolve multiple architecture designs — monolith, microservices,
            and serverless — then run an evolutionary tournament to surface the best fit for your
            project constraints.
          </p>

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
            <h2>Inspector</h2>
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
            <div className="callout">
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
                  <p className="node-tag">{selectedNode.kind}</p>
                  <h3>{selectedNode.name}</h3>
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
