"use client";

import type { QueryResult } from "@abhinav2203/coderag";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { CodeEditor } from "./code-editor.js";
import { GraphCanvas } from "./graph-canvas.js";
import { buildDetailFlow } from "../lib/flow-view.js";
import { computeHeatmap } from "../lib/heatmap.js";
import type { HeatmapData } from "../lib/heatmap.js";
import type { CycleReport, SmellReport, GraphMetrics } from "../lib/types.js";
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
} from "@abhinav2203/codeflow-core/schema";
import { emptyContract, traceSpanSchema } from "@abhinav2203/codeflow-core/schema";
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
} from "../lib/browser/storage.js";

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

type StatusTone = "info" | "success" | "danger";
type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

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
  const [codeSuggestion, setCodeSuggestion] = useState<{ summary: string; code: string; notes: string[] } | null>(null);
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
  const canRunIntegration = false;
  const isBusy = Boolean(busyLabel);
  const isBuilding = busyLabel === "Building blueprint";

  return (
    <div className="workbench-shell" data-theme={resolvedTheme}>
      <header className={`workbench-topbar ${graph ? "workbench-topbar-compact" : ""}`} ref={topbarRef}>
        <div className="topbar-start">
          <div className="brand-lockup">
            <p className="brand-eyebrow">CodeFlow</p>
            <h1>Policy Canvas</h1>
            <p className="brand-caption">Graph-native architecture, compliance, and deployment control.</p>
          </div>
        </div>
      </header>

      <main className="policy-layout focus-layout">
        <section className="workbench-main focus-main">
          <section className="graph-panel full-graph focus-graph">
            <GraphCanvas
              graph={graph}
              selectedNodeId={drilldownRootNode ? selectedDetailNodeId : selectedNodeId}
              nodes={detailFlow?.nodes}
              edges={detailFlow?.edges}
              onSelect={(nodeId) => setSelectedNodeId(nodeId)}
              heatmapData={drilldownRootNode ? undefined : heatmapData}
              theme={resolvedTheme}
            />
          </section>
        </section>
      </main>
    </div>
  );
}