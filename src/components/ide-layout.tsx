"use client";

import { useCallback, useMemo } from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";

import { useBlueprintStore } from "@/store/blueprint-store";

function getDefaultFloatingGraphBounds() {
  if (typeof window === "undefined") {
    return { x: 48, y: 48, width: 420, height: 320 };
  }

  const width = Math.max(360, Math.round(window.innerWidth * 0.3));
  const height = Math.max(260, Math.round(window.innerHeight * 0.35));
  const x = Math.max(24, window.innerWidth - width - 40);
  const y = Math.max(24, window.innerHeight - height - 120);

  return { x, y, width, height };
}

type IdeLayoutProps = {
  explorer: React.ReactNode;
  mainContent: React.ReactNode;
  bottomPanel?: React.ReactNode;
  floatingGraphContent?: React.ReactNode;
  rightSidebar?: React.ReactNode;
};

export function IdeLayout({
  explorer,
  mainContent,
  bottomPanel,
  floatingGraphContent,
  rightSidebar
}: IdeLayoutProps) {
  const { activeFile, floatingGraph, setFloatingGraph } = useBlueprintStore();

  const resolvedFloatingGraph = useMemo(() => {
    const defaults = getDefaultFloatingGraphBounds();
    return {
      x: floatingGraph.x || defaults.x,
      y: floatingGraph.y || defaults.y,
      width: floatingGraph.width || defaults.width,
      height: floatingGraph.height || defaults.height
    };
  }, [floatingGraph.height, floatingGraph.width, floatingGraph.x, floatingGraph.y]);

  const handleDragStop: RndDragCallback = useCallback(
    (_event, data) => {
      setFloatingGraph({ x: data.x, y: data.y });
    },
    [setFloatingGraph]
  );

  const handleResizeStop: RndResizeCallback = useCallback(
    (_event, _direction, ref, _delta, position) => {
      setFloatingGraph({
        x: position.x,
        y: position.y,
        width: parseInt(ref.style.width, 10),
        height: parseInt(ref.style.height, 10)
      });
    },
    [setFloatingGraph]
  );

  return (
    <div className="ide-layout-shell">
      <aside className="ide-left-sidebar">
        <div className="ide-pane-header">Explorer</div>
        <div className="ide-pane-body">{explorer}</div>
      </aside>
      <div className="ide-main-stack">
        <main className="ide-main-area">
          {mainContent}
          {activeFile && floatingGraph.visible && floatingGraphContent ? (
            <Rnd
              bounds="parent"
              className="ide-floating-graph"
              dragHandleClassName="ide-floating-graph-header"
              minHeight={220}
              minWidth={320}
              onDragStop={handleDragStop}
              onResizeStop={handleResizeStop}
              position={{ x: resolvedFloatingGraph.x, y: resolvedFloatingGraph.y }}
              size={{ width: resolvedFloatingGraph.width, height: resolvedFloatingGraph.height }}
            >
              <div className="ide-floating-graph-header">
                <span>Live Graph</span>
                <span>Drag to reposition</span>
              </div>
              <div className="ide-floating-graph-body">{floatingGraphContent}</div>
            </Rnd>
          ) : null}
        </main>
        <section className="ide-bottom-panel">{bottomPanel}</section>
      </div>
      <aside className="ide-right-sidebar">
        <div className="ide-pane-header">Agent</div>
        <div className="ide-pane-body">{rightSidebar ?? <div className="ide-agent-slot" />}</div>
      </aside>
    </div>
  );
}
