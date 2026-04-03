"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Rnd, type RndResizeCallback } from "react-rnd";

import { FileTree } from "@/components/file-tree";
import { GraphCanvas } from "@/components/graph-canvas";
import { getNavigationTarget, hasNavigationMetadata } from "@/lib/blueprint/node-navigation";
import { useBlueprintStore } from "@/store/blueprint-store";
import {
  readFloatingGraph,
  readRepoPath,
  readWorkbenchMode,
  writeFloatingGraph,
  writeRepoPath,
  writeWorkbenchMode
} from "@/lib/browser/storage";

function getDefaultFloatingGraphPosition(): { x: number; y: number } {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  return {
    x: Math.round(window.innerWidth * 0.7),
    y: Math.round(window.innerHeight * 0.65)
  };
}

export function IdeLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const {
    mode,
    setMode,
    activeFile,
    floatingGraph,
    setFloatingGraph,
    repoPath,
    setRepoPath,
    openFiles,
    setOpenFiles,
    setActiveFile,
    graph,
    selectedNodeId,
    setSelectedNodeId
  } = useBlueprintStore();

  const isIdeMode = mode === "ide";
  const showFloatingGraph = isIdeMode && activeFile !== null;

  const handleFileSelect = useCallback(
    (path: string) => {
      setOpenFiles([...new Set([...openFiles, path])]);
      setActiveFile(path);
    },
    [openFiles, setOpenFiles, setActiveFile]
  );

  const memoizedHandleFileSelect = useMemo(
    () => handleFileSelect,
    [handleFileSelect]
  );

  useEffect(() => {
    const savedMode = readWorkbenchMode();
    if (savedMode) {
      setMode(savedMode);
    }

    const savedRepoPath = readRepoPath();
    if (savedRepoPath) {
      setRepoPath(savedRepoPath);
    }

    const savedFloatingGraph = readFloatingGraph();
    if (savedFloatingGraph) {
      setFloatingGraph(savedFloatingGraph);
    }
  }, [setMode, setRepoPath, setFloatingGraph]);

  useEffect(() => {
    writeWorkbenchMode(mode);
  }, [mode]);

  useEffect(() => {
    writeRepoPath(repoPath);
  }, [repoPath]);

  useEffect(() => {
    if (floatingGraph.visible) {
      const { x, y, width, height } = floatingGraph;
      writeFloatingGraph({ x, y, width, height });
    }
  }, [floatingGraph]);

  // Graph-to-editor navigation: when a node is selected, open its source file
  useEffect(() => {
    if (!isIdeMode || !selectedNodeId || !graph) return;

    const node = graph.nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;

    // Check if node has navigation metadata
    if (!hasNavigationMetadata(node)) {
      console.debug(`Node ${node.name} has no source location metadata`);
      return;
    }

    const target = getNavigationTarget(node);
    if (target) {
      // Open the file and switch to IDE mode if needed
      const files = openFiles.includes(target.filePath)
        ? openFiles
        : [...openFiles, target.filePath];
      setOpenFiles(files);
      setActiveFile(target.filePath);

      // TODO: Scroll Monaco to the exact line (requires editor ref)
      console.debug(`Navigating to ${target.filePath}:${target.lineNumber}`);
    }
  }, [selectedNodeId, graph, isIdeMode, openFiles, setOpenFiles, setActiveFile]);

  const handleFloatingGraphDragStop = useCallback(
    (_: unknown, d: { x: number; y: number }) => {
      setFloatingGraph({ x: d.x, y: d.y });
    },
    [setFloatingGraph]
  );

  const handleFloatingGraphResizeStop: RndResizeCallback = useCallback(
    (_dir, _oldRef, newRef) => {
      const width = parseInt(newRef.style.width, 10);
      const height = parseInt(newRef.style.height, 10);
      setFloatingGraph({ width, height });
    },
    [setFloatingGraph]
  );

  const defaultPosition = getDefaultFloatingGraphPosition();

  return (
    <div className="ide-layout">
      <style jsx>{`
        .ide-layout {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .ide-left-sidebar {
          width: 280px;
          min-width: 200px;
          max-width: 400px;
          border-right: 1px solid #2a2a2a;
          display: flex;
          flex-direction: column;
          background: #1a1a1a;
        }

        .ide-main-area {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .ide-right-sidebar {
          width: 0;
          overflow: hidden;
          border-left: 1px solid #2a2a2a;
          transition: width 0.2s ease;
        }

        .ide-right-sidebar.reserved {
          width: 300px;
          min-width: 200px;
          max-width: 500px;
          background: #1a1a1a;
        }

        .floating-graph-panel {
          background: #1a1a1a;
          border: 1px solid #3a3a3a;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .floating-graph-header {
          padding: 8px 12px;
          background: #252525;
          border-bottom: 1px solid #2a2a2a;
          font-size: 12px;
          font-weight: 600;
          color: #a0a0a0;
          cursor: move;
        }

        .floating-graph-content {
          width: 100%;
          height: calc(100% - 36px);
        }
      `}</style>

      {/* Left Sidebar: File Explorer */}
      <div className="ide-left-sidebar">
        <FileTree onFileSelect={memoizedHandleFileSelect} selectedPath={activeFile ?? undefined} />
      </div>

      {/* Main Area */}
      <div className="ide-main-area">
        {children}

        {/* Floating Graph Panel in IDE mode */}
        {showFloatingGraph && (
          <Rnd
            default={{
              x: floatingGraph.x || defaultPosition.x,
              y: floatingGraph.y || defaultPosition.y,
              width: floatingGraph.width,
              height: floatingGraph.height
            }}
            minWidth={200}
            minHeight={150}
            bounds="parent"
            dragHandleClassName="floating-graph-header"
            onDragStop={handleFloatingGraphDragStop}
            onResizeStop={handleFloatingGraphResizeStop}
            className="floating-graph-panel"
          >
            <div className="floating-graph-header">Graph</div>
            <div className="floating-graph-content">
              <GraphCanvas graph={graph} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
            </div>
          </Rnd>
        )}
      </div>

      {/* Right Sidebar: Reserved for future OpenCode agent window */}
      <div className={`ide-right-sidebar ${isIdeMode ? "reserved" : ""}`}>
        {isIdeMode && <div />}
      </div>
    </div>
  );
}