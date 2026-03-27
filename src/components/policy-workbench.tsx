"use client";

import { z } from "zod";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { CodeEditor } from "@/components/code-editor";
import { GraphCanvas } from "@/components/graph-canvas";
import { generateNodeCode, getNodeStubPath, isCodeBearingNode } from "@/lib/blueprint/codegen";
import { addEdgeToGraph, addNodeToGraph, deleteNodeFromGraph } from "@/lib/blueprint/edit";
import { buildDetailFlow } from "@/lib/blueprint/flow-view";
import { computeHeatmap } from "@/lib/blueprint/heatmap";
import type { HeatmapData } from "@/lib/blueprint/heatmap";
import { canEnterImplementationPhase, canEnterIntegrationPhase, setGraphPhase } from "@/lib/blueprint/phases";
import { applyTraceOverlay } from "@/lib/blueprint/traces";
import type { CycleReport } from "@/lib/blueprint/cycles";
import type { SmellReport } from "@/lib/blueprint/smells";
import type { GraphMetrics } from "@/lib/blueprint/metrics";
import type {
  ApprovalRecord,
  BlueprintGraph,
  BlueprintNode,
  ConflictReport,
  ExecutionMode,
  ExportResult,
  ObservabilityLog,
  PersistedSession,
  RiskReport,
  RunPlan,
  RuntimeExecutionResult
} from "@/lib/blueprint/schema";
import { emptyContract, traceSpanSchema } from "@/lib/blueprint/schema";
import {
  AUTO_IMPLEMENT_STORAGE_KEY,
  LIVE_COMPLETIONS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  loadSessionApiKey,
  readLocalBooleanPreference,
  readLocalPreference,
  storeSessionApiKey,
  writeLocalBooleanPreference,
  writeLocalPreference
} from "@/lib/browser/storage";

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

type BuildStatusProbeResponse = {
  serverApiKeyConfigured?: boolean;
};

type CodeSuggestionResponse = {
  summary: string;
  code: string;
  notes: string[];
};

type StatusTone = "info" | "success" | "danger";
type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const tracesSchema = z.array(traceSpanSchema);
const THEME_CYCLE: ThemePreference[] = ["system", "light", "dark"];
const POLICY_CANVAS_PROMPT = `Act as an Enterprise Mobility Architect. Using the Google STITCH MCP server, design a secure Engineering Department device profile.

Create nodes for a managed Chrome browser policy enabling developer tools while disabling insecure extensions.
Add a node for a corporate VPN configuration.
Wire these to a Fleet: Engineering-Laptops group node.
Verify the STITCH contract before sync: every policy needs a valid version ID and the VPN policy needs its certificate reference.
If a policy node drifts from schema, mark it Invalid, highlight it in red, and suggest a Heal fix based on the latest Google management API spec.`;

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

const sentenceCase = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (segment) => segment.toUpperCase());

export function PolicyWorkbench() {
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
  const [showPolicyLayerPanel, setShowPolicyLayerPanel] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const [autoObservability, setAutoObservability] = useState(false);
  const [observabilityIntervalSecs, setObservabilityIntervalSecs] = useState(5);
  const autoObsRef = useRef(autoObservability);
  autoObsRef.current = autoObservability;
  const [autoImplementNodes, setAutoImplementNodes] = useState(false);
  const [cycleReport, setCycleReport] = useState<CycleReport | null>(null);
  const [smellReport, setSmellReport] = useState<SmellReport | null>(null);
  const [graphMetrics, setGraphMetrics] = useState<GraphMetrics | null>(null);
  const [mermaidDiagram, setMermaidDiagram] = useState<string | null>(null);
  const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;
  const topbarRef = useRef<HTMLElement | null>(null);
  const [floatingPanelTop, setFloatingPanelTop] = useState(112);

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
    ? `Browser session key active (${maskApiKey(nvidiaApiKey)}).`
    : serverApiKeyConfigured
      ? "Server environment key detected."
      : apiKeyStatusLoaded
        ? "No NVIDIA API key detected yet."
        : "Checking for a server-side NVIDIA API key...";
  const traceSummary = useMemo(() => {
    const summary = { synced: 0, deploying: 0, invalid: 0, idle: 0 };

    if (!graph) {
      return summary;
    }

    graph.nodes.forEach((node) => {
      switch (node.traceState?.status ?? "idle") {
        case "success":
          summary.synced += 1;
          break;
        case "warning":
          summary.deploying += 1;
          break;
        case "error":
          summary.invalid += 1;
          break;
        default:
          summary.idle += 1;
      }
    });

    return summary;
  }, [graph]);
  const complianceCoverage = graph?.nodes.length
    ? Math.round((traceSummary.synced / graph.nodes.length) * 100)
    : 0;
  const tracedNodeIds = useMemo(
    () =>
      graph?.nodes
        .filter((node) => Boolean(node.traceState?.count))
        .map((node) => node.id) ?? [],
    [graph]
  );
  const activeBatchIndex = useMemo(() => {
    if (!graph || !runPlan?.tasks.length) {
      return null;
    }

    if (graph.phase === "spec") {
      return 0;
    }

    if (graph.phase === "integration") {
      return runPlan.batches.at(-1)?.index ?? 0;
    }

    const taskForActiveNode = activeCodeNode
      ? runPlan.tasks.find((task) => task.nodeId === activeCodeNode.id)
      : undefined;
    if (taskForActiveNode) {
      return taskForActiveNode.batchIndex;
    }

    const nextImplementationTask = runPlan.tasks.find((task) => {
      const node = graph.nodes.find((candidate) => candidate.id === task.nodeId);
      return node && !["verified", "connected"].includes(node.status ?? "spec_only");
    });

    return nextImplementationTask?.batchIndex ?? 0;
  }, [activeCodeNode, graph, runPlan]);
  const activeBatchNodeIds = useMemo(
    () =>
      runPlan && activeBatchIndex !== null
        ? runPlan.tasks.filter((task) => task.batchIndex === activeBatchIndex).map((task) => task.nodeId)
        : [],
    [activeBatchIndex, runPlan]
  );
  const animatedNodeIds = useMemo(
    () => [...new Set([...tracedNodeIds, ...activeBatchNodeIds])],
    [activeBatchNodeIds, tracedNodeIds]
  );
  const breadcrumbItems = useMemo(() => {
    if (!graph) {
      return [];
    }

    const trailNodes = drilldownStack
      .map((nodeId) => graph.nodes.find((node) => node.id === nodeId))
      .filter((node): node is BlueprintNode => Boolean(node));

    return [
      { label: "Root", stackDepth: 0 },
      { label: graph.projectName, stackDepth: 0 },
      ...trailNodes.map((node, index) => ({
        label: node.name,
        stackDepth: index + 1
      }))
    ];
  }, [drilldownStack, graph]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowInspector(false);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !drilldownNodeId && graph && selectedNodeId) {
        setGraph(deleteNodeFromGraph(graph, selectedNodeId));
        setSelectedNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drilldownNodeId, graph, selectedNodeId]);

  useEffect(() => {
    const updateFloatingPanelTop = () => {
      const rect = topbarRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setFloatingPanelTop(Math.ceil(rect.bottom + 12));
    };

    updateFloatingPanelTop();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && topbarRef.current
        ? new ResizeObserver(() => updateFloatingPanelTop())
        : null;
    if (resizeObserver && topbarRef.current) {
      resizeObserver.observe(topbarRef.current);
    }

    window.addEventListener("resize", updateFloatingPanelTop);
    window.addEventListener("scroll", updateFloatingPanelTop, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateFloatingPanelTop);
      window.removeEventListener("scroll", updateFloatingPanelTop);
    };
  }, [graph]);

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

    const storedThemePreference = readLocalPreference(THEME_STORAGE_KEY);
    if (
      storedThemePreference === "system" ||
      storedThemePreference === "light" ||
      storedThemePreference === "dark"
    ) {
      setThemePreference(storedThemePreference);
    }
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setSystemTheme("light");
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyPreference = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    applyPreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyPreference);
      return () => mediaQuery.removeEventListener("change", applyPreference);
    }

    mediaQuery.addListener(applyPreference);
    return () => mediaQuery.removeListener(applyPreference);
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
    storeSessionApiKey(nvidiaApiKey);
  }, [nvidiaApiKey]);

  useEffect(() => {
    writeLocalBooleanPreference(LIVE_COMPLETIONS_STORAGE_KEY, liveCompletionsEnabled);
  }, [liveCompletionsEnabled]);

  useEffect(() => {
    writeLocalBooleanPreference(AUTO_IMPLEMENT_STORAGE_KEY, autoImplementNodes);
  }, [autoImplementNodes]);

  useEffect(() => {
    writeLocalPreference(THEME_STORAGE_KEY, themePreference);
  }, [themePreference]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

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

  const handleBreadcrumbNavigate = (stackDepth: number) => {
    if (!graph) {
      return;
    }

    const nextStack = drilldownStack.slice(0, stackDepth);
    const nextNodeId = nextStack.at(-1) ?? null;
    setDrilldownStack(nextStack);
    setSelectedNodeId(nextNodeId);
    setShowInspector(false);

    if (!nextNodeId) {
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

  const handleLoadPolicyCanvasPrompt = () => {
    setUseAI(true);
    setShowPromptPanel(true);
    setAiPrompt(POLICY_CANVAS_PROMPT);
    setStatusTone("info");
    setStatusTitle("Policy Canvas prompt loaded");
    setStatusDetail("Review the Engineering Department preset, then build the graph.");
  };

  const handleCycleTheme = () => {
    setThemePreference((current) => {
      const nextIndex = (THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length;
      return THEME_CYCLE[nextIndex] ?? "system";
    });
  };

  const renderSection = (title: string, items: string[]) => (
    <div className="callout" key={title}>
      <h3>{title}</h3>
      {items.length ? items.map((item) => <p key={`${title}:${item}`}>{item}</p>) : <p>None.</p>}
    </div>
  );

  const renderStatusCallout = (options?: { includeApiKeyStatus?: boolean; compact?: boolean }) => {
    const statusCalloutClassName = `callout status-callout ${
      statusTone === "danger" ? "danger-callout" : statusTone === "success" ? "success-callout" : "info-callout"
    }`;

    return (
      <div
        aria-live={statusTone === "danger" ? "assertive" : "polite"}
        className={statusCalloutClassName}
        role="status"
      >
        <h3>{statusTitle}</h3>
        <p>{statusDetail}</p>
        {graph ? (
          <>
            <p className="status-meta">Current phase: {graph.phase}</p>
            {options?.compact ? (
              <p className="status-meta">
                {graph.nodes.length} nodes · {graph.edges.length} edges · {graph.workflows.length} workflows
              </p>
            ) : null}
          </>
        ) : null}
        {options?.includeApiKeyStatus ? (
          <p className="status-meta">
            {useAI
              ? `API key status: ${apiKeyStatus}`
              : "Legacy mode analyzes PRD input plus JavaScript/TypeScript repos."}
          </p>
        ) : null}
      </div>
    );
  };

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

  const renderSourceReference = (node: BlueprintNode) => {
    const sourceRefs = node.sourceRefs.map((ref) =>
      [ref.kind, ref.path, ref.symbol, ref.section, ref.detail].filter(Boolean).join(" · ")
    );

    if (!sourceRefs.length && !node.generatedRefs.length && !node.traceRefs.length) {
      return null;
    }

    return (
      <>
        {sourceRefs.length ? renderSection("Source references", sourceRefs) : null}
        {node.generatedRefs.length ? renderSection("Generated references", node.generatedRefs) : null}
        {node.traceRefs.length ? renderSection("Trace references", node.traceRefs) : null}
      </>
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
            theme={resolvedTheme}
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
              theme={resolvedTheme}
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

  const themeLabel =
    themePreference === "system" ? `Auto (${sentenceCase(resolvedTheme)})` : sentenceCase(themePreference);
  const healthLabel =
    traceSummary.invalid > 0 ? "Heal required" : traceSummary.deploying > 0 ? "Deploying" : "Compliant";
  const shellStyle = {
    "--floating-panel-top": `${floatingPanelTop}px`
  } as CSSProperties;
  const renderPromptFields = () =>
    useAI ? (
      <label className="field">
        <span>Describe your project</span>
        <textarea
          value={aiPrompt}
          onChange={(event) => setAiPrompt(event.target.value)}
          rows={10}
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
    );

  return (
    <div className="workbench-shell" data-theme={resolvedTheme} style={shellStyle}>
      <header className={`workbench-topbar ${graph ? "workbench-topbar-compact" : ""}`} ref={topbarRef}>
        <div className="topbar-start">
          <div className="brand-lockup">
            <p className="brand-eyebrow">CodeFlow</p>
            <h1>Policy Canvas</h1>
            <p className="brand-caption">Graph-native architecture, compliance, and deployment control.</p>
          </div>
          <button onClick={() => setShowPolicyLayerPanel((current) => !current)} type="button">
            {showPolicyLayerPanel ? "Hide policy layer" : "Policy layer"}
          </button>
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
          {graph ? (
            <button onClick={() => setShowObservabilityPanel((current) => !current)} type="button">
              {showObservabilityPanel ? "Hide heatmap" : "Heatmap"}
            </button>
          ) : null}
        </div>
        <div className="topbar-end">
          <span className="mode-pill accent-pill">{healthLabel}</span>
          <span className="mode-pill">Coverage {complianceCoverage}%</span>
          <span className="mode-pill">{graph?.nodes.length ?? 0} nodes</span>
          <button className="theme-toggle" onClick={handleCycleTheme} type="button">
            Theme: {themeLabel}
          </button>
        </div>
      </header>

      <main className="policy-layout focus-layout">
        <section className="workbench-main focus-main">
          {!graph ? (
            <section className="panel welcome-panel">
              <div className="welcome-copy">
                <p className="brand-eyebrow">First Pass</p>
                <h2>Start with a prompt or repo input</h2>
                <p className="lead">
                  The main screen stays focused on the graph. Before the first build, the prompt lives here.
                </p>
                {renderStatusCallout({ includeApiKeyStatus: true })}
              </div>
              <div className="welcome-form">
                <div className="floating-panel-header">
                  <h2>Blueprint input</h2>
                  <button onClick={() => setShowPromptPanel(false)} type="button">
                    Hide
                  </button>
                </div>
                {showPromptPanel ? (
                  renderPromptFields()
                ) : (
                  <div className="callout">
                    <p>Click Prompt in the top bar whenever you want to reopen the input panel.</p>
                  </div>
                )}
                <div className="button-row">
                  <button onClick={handleLoadPolicyCanvasPrompt} type="button">
                    Engineering preset
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
              {renderStatusCallout({ compact: true })}
              <div className="graph-mode-strip">
                <span className="mode-pill">Phase {graph.phase}</span>
                <span className="mode-pill">{useAI ? "AI blueprint" : "Repo blueprint"}</span>
                <span className="mode-pill">{mode}</span>
                <span className="mode-pill accent-pill">{healthLabel}</span>
                {autoImplementNodes ? <span className="mode-pill accent-pill">Auto implement on</span> : null}
              </div>

              <section className="graph-panel full-graph focus-graph">
                <div className="graph-header">
                  <div>
                    <nav aria-label="Canvas breadcrumb" className={`canvas-breadcrumb ${drilldownRootNode ? "is-detail" : ""}`}>
                      {breadcrumbItems.map((item, index) => (
                        <span className="breadcrumb-segment" key={`${item.label}:${item.stackDepth}`}>
                          <button
                            className={`breadcrumb-chip ${index === breadcrumbItems.length - 1 ? "is-active" : ""}`}
                            onClick={() => handleBreadcrumbNavigate(item.stackDepth)}
                            type="button"
                          >
                            {item.label}
                          </button>
                          {index < breadcrumbItems.length - 1 ? <span className="breadcrumb-separator">/</span> : null}
                        </span>
                      ))}
                    </nav>
                    <h2>{drilldownRootNode ? `${drilldownRootNode.name} internals` : "Policy canvas"}</h2>
                    <p>
                      {drilldownRootNode && detailFlow
                        ? `${detailFlow.nodes.length} internal nodes, ${detailFlow.edges.length} edges`
                        : `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${graph.workflows.length} workflows`}
                    </p>
                    {!drilldownRootNode && runPlan ? (
                      <p className="status-meta">{`${runPlan.tasks.length} tasks across ${runPlan.batches.length} batches`}</p>
                    ) : null}
                    {!drilldownRootNode && runPlan && activeBatchIndex !== null ? (
                      <p className="status-meta">{`Mini-map focus: Batch ${activeBatchIndex + 1} · ${activeBatchNodeIds.length} nodes highlighted`}</p>
                    ) : null}
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
                </div>

                <GraphCanvas
                  graph={graph}
                  selectedNodeId={drilldownRootNode ? selectedDetailNodeId : selectedNodeId}
                  nodes={detailFlow?.nodes}
                  edges={detailFlow?.edges}
                  onNodeDoubleClick={handleGraphDoubleClick}
                  onSelect={handleGraphSelect}
                  activeNodeIds={animatedNodeIds}
                  detailMode={Boolean(drilldownRootNode)}
                  heatmapData={drilldownRootNode ? undefined : heatmapData}
                  theme={resolvedTheme}
                />
              </section>
            </>
          )}

          {pendingApproval ? (
            <div className="callout danger-callout overlay-callout">
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

          {error ? <p className="error canvas-error">{error}</p> : null}
        </section>
      </main>

      {graph && showPromptPanel ? (
        <section className="floating-panel prompt-panel">
          <div className="floating-panel-header">
            <h2>Blueprint input</h2>
            <button onClick={() => setShowPromptPanel(false)} type="button">
              Close
            </button>
          </div>
          {renderPromptFields()}
          <div className="button-row">
            <button onClick={handleLoadPolicyCanvasPrompt} type="button">
              Engineering preset
            </button>
          </div>
        </section>
      ) : null}

      {showPolicyLayerPanel ? (
        <section className="floating-panel policy-layer-panel">
          <div className="floating-panel-header">
            <h2>Policy Layer</h2>
            <button onClick={() => setShowPolicyLayerPanel(false)} type="button">
              Close
            </button>
          </div>
          <p className="lead">Model policies as nodes, wire inheritance, then sync with confidence.</p>
          <div className="signal-grid">
            <div className="signal-tile">
              <span className="signal-label">Green</span>
              <strong>{traceSummary.synced}</strong>
              <span>Synced</span>
            </div>
            <div className="signal-tile signal-warm">
              <span className="signal-label">Orange</span>
              <strong>{traceSummary.deploying}</strong>
              <span>Deploying</span>
            </div>
            <div className="signal-tile signal-hot">
              <span className="signal-label">Red</span>
              <strong>{traceSummary.invalid}</strong>
              <span>Invalid</span>
            </div>
          </div>
          <div className="button-row">
            <button onClick={handleLoadPolicyCanvasPrompt} type="button">
              Engineering preset
            </button>
            <button disabled={!graph} onClick={() => setShowObservabilityPanel(true)} type="button">
              Open heatmap
            </button>
          </div>
        </section>
      ) : null}

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
                <input aria-label="AI Prompt (NVIDIA)" checked={useAI} onChange={() => setUseAI(true)} type="radio" name="buildMode" />
                AI Prompt (NVIDIA)
              </label>
              <label>
                <input aria-label="PRD / Repo (JS/TS)" checked={!useAI} onChange={() => setUseAI(false)} type="radio" name="buildMode" />
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
            <input type="password" value={nvidiaApiKey} onChange={(event) => setNvidiaApiKey(event.target.value)} placeholder="nvapi-..." />
            <small>Status: {apiKeyStatus}</small>
          </label>
          <label className="choice-toggle">
            <input aria-label="Live completions" checked={liveCompletionsEnabled} onChange={(event) => setLiveCompletionsEnabled(event.target.checked)} type="checkbox" />
            Live completions
          </label>
          <label className="choice-toggle">
            <input aria-label="Auto implement nodes" checked={autoImplementNodes} onChange={(event) => setAutoImplementNodes(event.target.checked)} type="checkbox" />
            Auto implement each node in Phase 2
          </label>
        </aside>
      ) : null}

      {showEditPanel && graph ? (
        <section className="floating-panel edit-panel">
          <div className="floating-panel-header">
            <h2>Edit graph</h2>
            <button onClick={() => setShowEditPanel(false)} type="button">
              Close
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
        </section>
      ) : null}

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
              <p>Connected components: {graphMetrics.connectedComponents} · Isolated nodes: {graphMetrics.isolatedNodes}</p>
              <p>
                Node kinds:{" "}
                {Object.entries(graphMetrics.nodesByKind)
                  .map(([kind, count]) => `${kind} ${count}`)
                  .join(" · ") || "None"}
              </p>
            </div>
          ) : null}
          {smellReport ? (
            <div className="callout">
              <h3>Architecture Health: {smellReport.healthScore}/100</h3>
              <p>{smellReport.totalSmells} smell{smellReport.totalSmells === 1 ? "" : "s"} detected</p>
              {smellReport.smells.length ? (
                <div>
                  {smellReport.smells.map((smell) => (
                    <div className="smell-item" key={`${smell.code}:${smell.nodeId ?? "global"}`}>
                      <p>
                        <strong>{smell.code}</strong> · {smell.severity}
                      </p>
                      {smell.nodeId ? <p>{smell.nodeId}</p> : null}
                      <p>{smell.message}</p>
                      <p className="status-meta">{smell.suggestion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No architecture smells detected.</p>
              )}
            </div>
          ) : null}
          <div className="callout">
            <h3>Dependency Cycles</h3>
            {cycleReport ? (
              cycleReport.totalCycles > 0 ? (
                cycleReport.cycles.map((cycle, index) => (
                  <div className="cycle-item" key={`${cycle.nodeIds.join("->")}:${index}`}>
                    <p>
                      <strong>Cycle {index + 1}</strong> · {cycle.nodeIds.length} nodes · {cycle.edges.length} edges
                    </p>
                    <p>{cycle.nodeIds.join(" -> ")}</p>
                  </div>
                ))
              ) : (
                <p>No dependency cycles found. Graph is a clean DAG!</p>
              )
            ) : (
              <p>Cycle report is not available yet.</p>
            )}
          </div>
          {mermaidDiagram ? (
            <div className="callout">
              <h3>Mermaid Diagram</h3>
              <pre className="mermaid-output">{mermaidDiagram}</pre>
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
          {heatmapData ? (
            <div className="callout">
              <h3>Node Heatmap</h3>
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
                  {heatmapData.nodes.slice().sort((a, b) => b.heatIntensity - a.heatIntensity).map((metric) => (
                    <tr key={metric.nodeId} className={metric.heatIntensity > 0.66 ? "heat-row-hot" : metric.heatIntensity > 0.33 ? "heat-row-warm" : ""}>
                      <td title={metric.nodeId}>{metric.name}</td>
                      <td>{metric.callCount}</td>
                      <td>{metric.errorCount}</td>
                      <td>{metric.avgDurationMs.toFixed(1)}</td>
                      <td>
                        <div className="heat-bar-track">
                          <div className="heat-bar-fill" style={{ width: `${Math.round(metric.heatIntensity * 100)}%` }} />
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
          {drilldownRootNode && selectedDetailItem ? (
            <>
              <div className="callout">
                <p className="node-tag">{selectedDetailItem.kind}</p>
                <h3>{selectedDetailItem.label}</h3>
                <p>{selectedDetailItem.summary}</p>
              </div>
              {selectedDetailItem.sections.length
                ? selectedDetailItem.sections.map((section) => renderSection(section.title, section.items))
                : renderSection("Details", ["No further documentation available for this node."])}
              {renderCodeEditorPanel()}
            </>
          ) : selectedNode && graph ? (
            <>
              <div className="callout">
                <p className="node-tag">{selectedNode.kind}</p>
                <h3>{selectedNode.name}</h3>
                <p>Current phase: {graph.phase}</p>
                <p>
                  Node status: <strong>{selectedNode.status ?? "spec_only"}</strong>
                </p>
                {selectedNode.signature ? <p>Signature: {selectedNode.signature}</p> : null}
                {selectedNode.path ? <p>Path: {selectedNode.path}</p> : null}
                {selectedNode.traceState ? (
                  <p>
                    Trace status: {selectedNode.traceState.status} · calls {selectedNode.traceState.count} · errors{" "}
                    {selectedNode.traceState.errors}
                  </p>
                ) : null}
                {selectedNode.lastVerification ? (
                  <p>
                    Verification: {selectedNode.lastVerification.status} · exit code{" "}
                    {selectedNode.lastVerification.exitCode ?? 0}
                  </p>
                ) : null}
              </div>
              <label className="field">
                <span>Summary</span>
                <textarea
                  onChange={(event) => {
                    setGraph((current) =>
                      current && selectedNodeId
                        ? updateNode(current, selectedNodeId, (node) => ({
                            ...node,
                            summary: event.target.value,
                            contract: {
                              ...normalizeContract(node.contract),
                              summary: event.target.value
                            }
                          }))
                        : current
                    );
                  }}
                  rows={3}
                  value={selectedNode.summary}
                />
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  onChange={(event) => {
                    const notes = event.target.value
                      .split("\n")
                      .map((note) => note.trim())
                      .filter(Boolean);
                    setGraph((current) =>
                      current && selectedNodeId
                        ? updateNode(current, selectedNodeId, (node) => ({
                            ...node,
                            contract: {
                              ...normalizeContract(node.contract),
                              notes
                            }
                          }))
                        : current
                    );
                  }}
                  placeholder="Add implementation notes, compliance checks, or rollout considerations..."
                  rows={4}
                  value={normalizeContract(selectedNode.contract).notes.join("\n")}
                />
              </label>
              {renderSourceReference(selectedNode)}
              {renderBlueprintNodeDocumentation(selectedNode)}
              {activeCodeNode ? renderCodeEditorPanel() : null}
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
