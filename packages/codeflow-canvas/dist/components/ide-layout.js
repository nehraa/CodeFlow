"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useMemo } from "react";
import { Rnd } from "react-rnd";
import { useBlueprintStore } from "../store/blueprint-store.js";
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
export function IdeLayout({ explorer, mainContent, bottomPanel, floatingGraphContent, rightSidebar }) {
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
    const handleDragStop = useCallback((_event, data) => {
        setFloatingGraph({ x: data.x, y: data.y });
    }, [setFloatingGraph]);
    const handleResizeStop = useCallback((_event, _direction, ref, _delta, position) => {
        setFloatingGraph({
            x: position.x,
            y: position.y,
            width: parseInt(ref.style.width, 10),
            height: parseInt(ref.style.height, 10)
        });
    }, [setFloatingGraph]);
    return (_jsxs("div", { className: "ide-layout-shell", children: [_jsxs("aside", { className: "ide-left-sidebar", children: [_jsx("div", { className: "ide-pane-header", children: "Explorer" }), _jsx("div", { className: "ide-pane-body", children: explorer })] }), _jsxs("div", { className: "ide-main-stack", children: [_jsxs("main", { className: "ide-main-area", children: [mainContent, activeFile && floatingGraph.visible && floatingGraphContent ? (_jsxs(Rnd, { bounds: "parent", className: "ide-floating-graph", dragHandleClassName: "ide-floating-graph-header", minHeight: 220, minWidth: 320, onDragStop: handleDragStop, onResizeStop: handleResizeStop, position: { x: resolvedFloatingGraph.x, y: resolvedFloatingGraph.y }, size: { width: resolvedFloatingGraph.width, height: resolvedFloatingGraph.height }, children: [_jsxs("div", { className: "ide-floating-graph-header", children: [_jsx("span", { children: "Live Graph" }), _jsx("span", { children: "Drag to reposition" })] }), _jsx("div", { className: "ide-floating-graph-body", children: floatingGraphContent })] })) : null] }), _jsx("section", { className: "ide-bottom-panel", children: bottomPanel })] }), _jsxs("aside", { className: "ide-right-sidebar", children: [_jsx("div", { className: "ide-pane-header", children: "Agent" }), _jsx("div", { className: "ide-pane-body", children: rightSidebar ?? _jsx("div", { className: "ide-agent-slot" }) })] })] }));
}
//# sourceMappingURL=ide-layout.js.map