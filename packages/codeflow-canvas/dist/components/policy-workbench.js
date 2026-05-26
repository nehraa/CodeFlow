"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from "react";
import { GraphCanvas } from "./graph-canvas.js";
import { buildDetailFlow } from "../lib/flow-view.js";
import { computeHeatmap } from "../lib/heatmap.js";
const POLICY_CANVAS_PROMPT = `Act as an Enterprise Mobility Architect. Using the Google STITCH MCP server, design a secure Engineering Department device profile.

Create nodes for a managed Chrome browser policy enabling developer tools while disabling insecure extensions.
Add a node for a corporate VPN configuration.
Wire these to a Fleet: Engineering-Laptops group node.
Verify the STITCH contract before sync: every policy needs a valid version ID and the VPN policy needs its certificate reference.
If a policy node drifts from schema, mark it Invalid, highlight it in red, and suggest a Heal fix based on the latest Google management API spec.`;
const maskApiKey = (value) => {
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
    const [mode, setMode] = useState("essential");
    const [outputDir, setOutputDir] = useState("");
    const [traceInput, setTraceInput] = useState("");
    const [runInput, setRunInput] = useState("{}");
    const [graph, setGraph] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [error, setError] = useState(null);
    const [busyLabel, setBusyLabel] = useState(null);
    const [exportResult, setExportResult] = useState(null);
    const [runPlan, setRunPlan] = useState(null);
    const [riskReport, setRiskReport] = useState(null);
    const [session, setSession] = useState(null);
    const [pendingApproval, setPendingApproval] = useState(null);
    const [executionResult, setExecutionResult] = useState(null);
    const [latestLogs, setLatestLogs] = useState([]);
    const [latestSpans, setLatestSpans] = useState([]);
    const [conflictReport, setConflictReport] = useState(null);
    const [newNodeName, setNewNodeName] = useState("");
    const [newNodeKind, setNewNodeKind] = useState("function");
    const [edgeFrom, setEdgeFrom] = useState("");
    const [edgeTo, setEdgeTo] = useState("");
    const [edgeKind, setEdgeKind] = useState("calls");
    const [useAI, setUseAI] = useState(true);
    const [drilldownStack, setDrilldownStack] = useState([]);
    const [selectedDetailNodeId, setSelectedDetailNodeId] = useState(null);
    const [codeDrafts, setCodeDrafts] = useState({});
    const [suggestionInstruction, setSuggestionInstruction] = useState("");
    const [codeSuggestion, setCodeSuggestion] = useState(null);
    const [liveCompletionsEnabled, setLiveCompletionsEnabled] = useState(true);
    const [serverApiKeyConfigured, setServerApiKeyConfigured] = useState(false);
    const [apiKeyStatusLoaded, setApiKeyStatusLoaded] = useState(false);
    const [statusTitle, setStatusTitle] = useState("Ready to build");
    const [statusDetail, setStatusDetail] = useState("Enter a project description or repo input, then build a blueprint.");
    const [statusTone, setStatusTone] = useState("info");
    const [showSettings, setShowSettings] = useState(false);
    const [showPromptPanel, setShowPromptPanel] = useState(true);
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [showInspector, setShowInspector] = useState(false);
    const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
    const [showObservabilityPanel, setShowObservabilityPanel] = useState(false);
    const [showPolicyLayerPanel, setShowPolicyLayerPanel] = useState(false);
    const [themePreference, setThemePreference] = useState("system");
    const [systemTheme, setSystemTheme] = useState("light");
    const [autoObservability, setAutoObservability] = useState(false);
    const [observabilityIntervalSecs, setObservabilityIntervalSecs] = useState(5);
    const autoObsRef = useRef(autoObservability);
    autoObsRef.current = autoObservability;
    const [autoImplementNodes, setAutoImplementNodes] = useState(false);
    const [cycleReport, setCycleReport] = useState(null);
    const [smellReport, setSmellReport] = useState(null);
    const [graphMetrics, setGraphMetrics] = useState(null);
    const [mermaidDiagram, setMermaidDiagram] = useState(null);
    const resolvedTheme = themePreference === "system" ? systemTheme : themePreference;
    const topbarRef = useRef(null);
    const [floatingPanelTop, setFloatingPanelTop] = useState(112);
    const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId) ?? null;
    const drilldownNodeId = drilldownStack.at(-1) ?? null;
    const drilldownRootNode = graph?.nodes.find((node) => node.id === drilldownNodeId) ?? null;
    const detailFlow = graph && drilldownNodeId
        ? buildDetailFlow(graph, drilldownNodeId, selectedDetailNodeId ?? undefined)
        : null;
    const heatmapData = useMemo(() => graph &&
        graph.nodes.some((node) => node.traceState && node.traceState.count > 0)
        ? computeHeatmap(graph)
        : undefined, [graph]);
    const canStartImplementation = false;
    const canStartIntegration = false;
    const canImplementActiveNode = false;
    const canRunActiveNode = false;
    const canRunIntegration = false;
    const isBusy = Boolean(busyLabel);
    const isBuilding = busyLabel === "Building blueprint";
    return (_jsxs("div", { className: "workbench-shell", "data-theme": resolvedTheme, children: [_jsx("header", { className: `workbench-topbar ${graph ? "workbench-topbar-compact" : ""}`, ref: topbarRef, children: _jsx("div", { className: "topbar-start", children: _jsxs("div", { className: "brand-lockup", children: [_jsx("p", { className: "brand-eyebrow", children: "CodeFlow" }), _jsx("h1", { children: "Policy Canvas" }), _jsx("p", { className: "brand-caption", children: "Graph-native architecture, compliance, and deployment control." })] }) }) }), _jsx("main", { className: "policy-layout focus-layout", children: _jsx("section", { className: "workbench-main focus-main", children: _jsx("section", { className: "graph-panel full-graph focus-graph", children: _jsx(GraphCanvas, { graph: graph, selectedNodeId: drilldownRootNode ? selectedDetailNodeId : selectedNodeId, nodes: detailFlow?.nodes, edges: detailFlow?.edges, onSelect: (nodeId) => setSelectedNodeId(nodeId), heatmapData: drilldownRootNode ? undefined : heatmapData, theme: resolvedTheme }) }) }) })] }));
}
//# sourceMappingURL=policy-workbench.js.map