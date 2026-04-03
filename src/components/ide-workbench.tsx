"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor } from "./code-editor";
import { CodeDiffEditor } from "./code-diff-editor";
import { IdeLayout } from "./ide-layout";
import { FileTabs } from "./file-tabs";
import { useBlueprintStore } from "@/store/blueprint-store";

import type {
    BlueprintGraph,
    HeatmapData,
    VcrRecording,
    ObservabilityLog,
    GhostNode,
    ExecutionArtifact,
    ExecutionStep,
    ExportResult
} from "@/lib/blueprint/schema";

type IdeWorkbenchProps = {
    children?: React.ReactNode;
};

/**
 * IdeWorkbench - Full CodeFlow feature parity in IDE mode.
 *
 * This component wraps IdeLayout and adds all CodeFlow capabilities:
 * - VCR/replay controls
 * - Heatmap/observability panels
 * - Execution status and run feedback
 * - Export/approval workflows
 * - Settings and editor controls
 *
 * The floating graph in IdeLayout receives these signals and displays
 * node status in real-time.
 */
export function IdeWorkbench({ children }: IdeWorkbenchProps): JSX.Element {
    const {
        activeFile,
        mode,
        graph,
        selectedNodeId,
        setSelectedNodeId
    } = useBlueprintStore();

    // Feature state - these mirror workbench capabilities
    const [showVcrPanel, setShowVcrPanel] = useState(false);
    const [vcrRecording, setVcrRecording] = useState<VcrRecording | null>(null);
    const [vcrFrameIndex, setVcrFrameIndex] = useState(0);
    const [vcrPlaying, setVcrPlaying] = useState(false);

    const [showHeatmap, setShowHeatmap] = useState(false);

    const [showObservability, setShowObservability] = useState(false);
    const [observabilityLogs, setObservabilityLogs] = useState<ObservabilityLog[]>([]);

    const [ghostNodes, setGhostNodes] = useState<GhostNode[]>([]);
    const [executionArtifacts, setExecutionArtifacts] = useState<ExecutionArtifact[]>([]);

    const [showExportPanel, setShowExportPanel] = useState(false);
    const [exportResult, setExportResult] = useState<ExportResult | null>(null);

    const [showDiffEditor, setShowDiffEditor] = useState(false);
    const [diffOriginal, setDiffOriginal] = useState("");
    const [diffModified, setDiffModified] = useState("");

    const vcrIntervalRef = useRef<number | null>(null);

    // VCR playback effect
    useEffect(() => {
        if (!vcrPlaying || !vcrRecording) return;

        vcrIntervalRef.current = window.setInterval(() => {
            setVcrFrameIndex((prev) => {
                const next = prev + 1;
                if (next >= vcrRecording.frames.length) {
                    setVcrPlaying(false);
                    return prev;
                }
                return next;
            });
        }, 1000);

        return () => {
            if (vcrIntervalRef.current) {
                clearInterval(vcrIntervalRef.current);
            }
        };
    }, [vcrPlaying, vcrRecording]);

    // Keyboard shortcuts for IDE features
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl+Shift+R for VCR toggle
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
                e.preventDefault();
                setShowVcrPanel((s) => !s);
            }
            // Cmd/Ctrl+Shift+H for heatmap toggle
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "H") {
                e.preventDefault();
                setShowHeatmap((s) => !s);
            }
            // Cmd/Ctrl+Shift+O for observability toggle
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "O") {
                e.preventDefault();
                setShowObservability((s) => !s);
            }
            // Escape to close panels
            if (e.key === "Escape") {
                setShowVcrPanel(false);
                setShowObservability(false);
                setShowDiffEditor(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const isIdeMode = mode === "ide";

    // Don't render in graph mode
    if (!isIdeMode) {
        return <>{children}</>;
    }

    return (
        <IdeLayout>
            <div className="ide-workbench">
                <style jsx>{`
                    .ide-workbench {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        width: 100%;
                        background: #1a1a1a;
                    }

                    .ide-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 12px;
                        background: #252525;
                        border-bottom: 1px solid #2a2a2a;
                        min-height: 40px;
                    }

                    .ide-toolbar-group {
                        display: flex;
                        gap: 4px;
                        padding: 0 8px;
                        border-right: 1px solid #3a3a3a;
                    }

                    .ide-toolbar-group:last-child {
                        border-right: none;
                    }

                    .ide-toolbar-button {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 10px;
                        background: #2a2a2a;
                        border: 1px solid #3a3a3a;
                        border-radius: 4px;
                        color: #a0a0a0;
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.15s ease;
                    }

                    .ide-toolbar-button:hover {
                        background: #333;
                        color: #e0e0e0;
                    }

                    .ide-toolbar-button.active {
                        background: #3a4a5a;
                        border-color: #4a6a8a;
                        color: #80c0ff;
                    }

                    .ide-toolbar-button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    .ide-main {
                        flex: 1;
                        display: flex;
                        overflow: hidden;
                    }

                    .ide-editor-panel {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }

                    .ide-status-bar {
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        padding: 6px 12px;
                        background: #252525;
                        border-top: 1px solid #2a2a2a;
                        font-size: 12px;
                        color: #808080;
                    }

                    .ide-status-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .ide-feature-panel {
                        position: absolute;
                        top: 48px;
                        right: 0;
                        width: 320px;
                        height: calc(100% - 48px);
                        background: #1a1a1a;
                        border-left: 1px solid #2a2a2a;
                        z-index: 100;
                        display: flex;
                        flex-direction: column;
                    }

                    .ide-panel-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 12px;
                        border-bottom: 1px solid #2a2a2a;
                        background: #252525;
                    }

                    .ide-panel-title {
                        font-size: 13px;
                        font-weight: 600;
                        color: #e0e0e0;
                    }

                    .ide-panel-close {
                        padding: 4px 8px;
                        background: transparent;
                        border: none;
                        color: #a0a0a0;
                        font-size: 16px;
                        cursor: pointer;
                    }

                    .ide-panel-close:hover {
                        color: #e0e0e0;
                    }

                    .ide-panel-content {
                        flex: 1;
                        overflow: auto;
                        padding: 12px;
                    }
                `}</style>

                {/* IDE Toolbar with CodeFlow features */}
                <div className="ide-toolbar">
                    <div className="ide-toolbar-group">
                        <button
                            className={`ide-toolbar-button ${showVcrPanel ? "active" : ""}`}
                            onClick={() => setShowVcrPanel((s) => !s)}
                            title="VCR Replay (Cmd+Shift+R)"
                        >
                            <span>▶</span>
                            <span>VCR</span>
                        </button>
                        <button
                            className={`ide-toolbar-button ${showHeatmap ? "active" : ""}`}
                            onClick={() => setShowHeatmap((s) => !s)}
                            title="Heatmap (Cmd+Shift+H)"
                        >
                            <span>🔥</span>
                            <span>Heatmap</span>
                        </button>
                        <button
                            className={`ide-toolbar-button ${showObservability ? "active" : ""}`}
                            onClick={() => setShowObservability((s) => !s)}
                            title="Observability (Cmd+Shift+O)"
                        >
                            <span>📊</span>
                            <span>Observability</span>
                        </button>
                    </div>

                    <div className="ide-toolbar-group">
                        <button
                            className="ide-toolbar-button"
                            onClick={() => setShowDiffEditor((s) => !s)}
                            disabled={!activeFile}
                        >
                            <span>📝</span>
                            <span>Diff</span>
                        </button>
                        <button
                            className="ide-toolbar-button"
                            onClick={() => setShowExportPanel((s) => !s)}
                        >
                            <span>📤</span>
                            <span>Export</span>
                        </button>
                    </div>

                    <div className="ide-toolbar-group" style={{ marginLeft: "auto" }}>
                        {graph && (
                            <span style={{ fontSize: "12px", color: "#808080" }}>
                                {graph.nodes.length} nodes | {graph.edges.length} edges
                            </span>
                        )}
                    </div>
                </div>

                {/* Main editor area */}
                <div className="ide-main">
                    <div className="ide-editor-panel">
                        {activeFile ? (
                            showDiffEditor ? (
                                <CodeDiffEditor
                                    originalValue={diffOriginal}
                                    modifiedValue={diffModified}
                                    language="typescript"
                                    height="100%"
                                />
                            ) : (
                                <FileTabs />
                            )
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    color: "#606060"
                                }}
                            >
                                <span style={{ fontSize: 48, marginBottom: 16 }}>🐱</span>
                                <p>Select a file to start coding</p>
                                <p style={{ fontSize: 12 }}>Or switch to Graph mode (Cmd+Shift+E)</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status bar */}
                <div className="ide-status-bar">
                    <div className="ide-status-item">
                        <span>🐱</span>
                        <span>CodeFlow IDE</span>
                    </div>
                    {showVcrPanel && vcrRecording && (
                        <div className="ide-status-item">
                            <span>VCR: Frame {vcrFrameIndex + 1}/{vcrRecording.frames.length}</span>
                            {vcrPlaying && <span style={{ color: "#80c0ff" }}>▶ Playing</span>}
                        </div>
                    )}
                    {showHeatmap && (
                        <div className="ide-status-item">
                            <span style={{ color: "#ff8080" }}>🔥 Heatmap active</span>
                        </div>
                    )}
                    {selectedNodeId && (
                        <div className="ide-status-item" style={{ marginLeft: "auto" }}>
                            <span>Node: {selectedNodeId}</span>
                        </div>
                    )}
                </div>

                {/* VCR Panel */}
                {showVcrPanel && (
                    <div className="ide-feature-panel">
                        <div className="ide-panel-header">
                            <span className="ide-panel-title">VCR Replay</span>
                            <button
                                className="ide-panel-close"
                                onClick={() => setShowVcrPanel(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="ide-panel-content">
                            {vcrRecording ? (
                                <div>
                                    <div style={{ marginBottom: 12 }}>
                                        <button
                                            onClick={() => setVcrPlaying((p) => !p)}
                                            style={{
                                                padding: "8px 16px",
                                                background: vcrPlaying ? "#3a4a5a" : "#2a3a4a",
                                                border: "1px solid #4a6a8a",
                                                borderRadius: 4,
                                                color: "#e0e0e0",
                                                cursor: "pointer"
                                            }}
                                        >
                                            {vcrPlaying ? "⏸ Pause" : "▶ Play"}
                                        </button>
                                        <span style={{ marginLeft: 12, color: "#808080" }}>
                                            Frame {vcrFrameIndex + 1} of {vcrRecording.frames.length}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={vcrRecording.frames.length - 1}
                                        value={vcrFrameIndex}
                                        onChange={(e) => setVcrFrameIndex(parseInt(e.target.value))}
                                        style={{ width: "100%" }}
                                    />
                                </div>
                            ) : (
                                <p style={{ color: "#808080" }}>No VCR recording loaded</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Heatmap Panel */}
                {showHeatmap && (
                    <div className="ide-feature-panel">
                        <div className="ide-panel-header">
                            <span className="ide-panel-title">Heatmap</span>
                            <button
                                className="ide-panel-close"
                                onClick={() => setShowHeatmap(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="ide-panel-content">
                            <p style={{ color: "#808080" }}>Node execution heatmap</p>
                            <p style={{ fontSize: 12, color: "#606060", marginTop: 8 }}>
                                Heatmap data reflects on the floating graph in real-time.
                            </p>
                        </div>
                    </div>
                )}

                {/* Observability Panel */}
                {showObservability && (
                    <div className="ide-feature-panel">
                        <div className="ide-panel-header">
                            <span className="ide-panel-title">Observability</span>
                            <button
                                className="ide-panel-close"
                                onClick={() => setShowObservability(false)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="ide-panel-content">
                            {observabilityLogs.length > 0 ? (
                                observabilityLogs.map((log, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: "8px",
                                            borderBottom: "1px solid #2a2a2a",
                                            fontSize: 12
                                        }}
                                    >
                                        <span style={{ color: "#608080" }}>{log.timestamp}</span>
                                        <span style={{ marginLeft: 8, color: "#e0e0e0" }}>
                                            {log.message}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: "#808080" }}>No observability data available</p>
                            )}
                        </div>
                    </div>
                )}

                {children}
            </div>
        </IdeLayout>
    );
}
