"use client";

import type { QueryResult } from "@abhinav2203/coderag";
import { z } from "zod";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useBlueprintStore } from "../store/blueprint-store.js";

import { CodeEditor } from "./code-editor.js";
import { FileTabs } from "./file-tabs.js";
import { FileTree } from "./file-tree.js";
import { GraphCanvas } from "./graph-canvas.js";
import { IdeLayout } from "./ide-layout.js";
import { buildDetailFlow, indexRuntimeExecutionResult } from "../lib/flow-view.js";
import { computeHeatmap } from "../lib/heatmap.js";
import type { HeatmapData } from "../lib/heatmap.js";
import { formatNavigationTarget, getNavigationTarget, isValidNavigationTarget } from "../lib/node-navigation.js";
import { applyTraceOverlay } from "../lib/traces.js";
import type { CycleReport, SmellReport, GraphMetrics, RefactorReport, HealResult, OpencodeServerInfo } from "../lib/types.js";
import {
  AUTO_IMPLEMENT_STORAGE_KEY,
  LIVE_COMPLETIONS_STORAGE_KEY,
  loadSessionApiKey,
  readLocalBooleanPreference,
  readRepoPath,
  storeSessionApiKey,
  writeLocalBooleanPreference,
  writeRepoPath
} from "../lib/browser/storage.js";
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
} from "@abhinav2203/codeflow-core/schema";
import { emptyContract, traceSpanSchema } from "@abhinav2203/codeflow-core/schema";

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

const tracesSchema = z.array(traceSpanSchema);

const maskApiKey = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

type StatusTone = "info" | "success" | "danger";
type IdeDockTab = "terminal" | "repo" | "heatmap" | "vcr" | "traces" | "problems";
type ActivityEntryTone = "info" | "success" | "error" | "command";
type ActivityEntry = {
  id: string;
  source: string;
  message: string;
  tone: ActivityEntryTone;
  timestamp: string;
  detail?: string;
};

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
  const [codeSuggestion, setCodeSuggestion] = useState<{ summary: string; code: string; notes: string[] } | null>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const [showPromptPanel, setShowPromptPanel] = useState(true);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
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

  const [branches, setBranches] = useState<GraphBranch[]>([]);
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchDescription, setNewBranchDescription] = useState("");
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branchDiff, setBranchDiff] = useState<BranchDiff | null>(null);
  const [diffTargetBranchId, setDiffTargetBranchId] = useState<string | null>(null);

  const [showVcrPanel, setShowVcrPanel] = useState(false);
  const [vcrRecording, setVcrRecording] = useState<VcrRecording | null>(null);
  const [vcrFrameIndex, setVcrFrameIndex] = useState(0);
  const [vcrPlaying, setVcrPlaying] = useState(false);
  const [vcrGraph, setVcrGraph] = useState<BlueprintGraph | null>(null);
  const [vcrError, setVcrError] = useState<string | null>(null);

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

  const [showRefactorPanel, setShowRefactorPanel] = useState(false);
  const [refactorReport, setRefactorReport] = useState<RefactorReport | null>(null);
  const [healResult, setHealResult] = useState<HealResult | null>(null);
  const [refactorError, setRefactorError] = useState<string | null>(null);
  const graphReplacedByHealRef = useRef(false);
  const refactorAbortRef = useRef<AbortController | null>(null);

  const [showGeneticPanel, setShowGeneticPanel] = useState(false);
  const [showMascotPanel, setShowMascotPanel] = useState(false);
  const [showPhasePanel, setShowPhasePanel] = useState(false);
  const [geneticGenerations, setGeneticGenerations] = useState(3);
  const [geneticPopulationSize, setGeneticPopulationSize] = useState(6);
  const [tournamentResult, setTournamentResult] = useState<TournamentResult | null>(null);
  const [geneticError, setGeneticError] = useState<string | null>(null);
  const [editorRevealTarget, setEditorRevealTarget] = useState<ReturnType<typeof getNavigationTarget>>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);

  const [showOpencodePanel, setShowOpencodePanel] = useState(false);
  const [opencodeStatus, setOpencodeStatus] = useState<OpencodeServerInfo>({ status: "stopped" });
  const [useOpencodeForAgent, setUseOpencodeForAgent] = useState(false);

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

  const canStartImplementation = false;
  const canStartIntegration = false;
  const canImplementActiveNode = false;
  const canRunActiveNode = false;
  const isBusy = Boolean(busyLabel);
  const isBuilding = busyLabel === "Building blueprint";

  return (
    <div className="workbench-shell">
      <div className="workbench-main">
        <div className="graph-panel">
          <GraphCanvas
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
            heatmapData={heatmapData}
          />
        </div>
      </div>
    </div>
  );
}