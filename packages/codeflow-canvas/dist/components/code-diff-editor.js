"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useRef } from "react";
import dynamic from "next/dynamic";
import { prepareMonaco, toMonacoPath } from "./monaco-setup.js";
const MonacoDiffEditor = dynamic(() => import("@monaco-editor/react").then(mod => mod.DiffEditor), {
    ssr: false,
    loading: () => _jsx("div", { className: "code-diff-editor-loading", children: "Loading diff editor..." })
});
export function CodeDiffEditor({ originalValue, modifiedValue, language = "typescript", height = "28rem", readOnly = false, theme = "dark", onModifiedChange }) {
    const monacoRef = useRef(null);
    const modifiedListenerRef = useRef(null);
    return (_jsx("div", { className: "code-diff-editor-shell", style: {
            height,
            minHeight: height === "100%" ? 0 : height
        }, children: _jsx(MonacoDiffEditor, { beforeMount: prepareMonaco, height: height, language: language, modified: modifiedValue, modifiedModelPath: toMonacoPath("diff/modified.ts"), options: {
                automaticLayout: true,
                diffCodeLens: true,
                enableSplitViewResizing: true,
                fontFamily: "IBM Plex Mono, SFMono-Regular, SF Mono, monospace",
                fontLigatures: true,
                fontSize: 14,
                lineNumbersMinChars: 3,
                minimap: { enabled: false },
                padding: { top: 16, bottom: 16 },
                readOnly,
                renderSideBySide: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                wordWrap: "on"
            }, original: originalValue, originalModelPath: toMonacoPath("diff/original.ts"), onMount: (editor, monaco) => {
                monacoRef.current = monaco;
                modifiedListenerRef.current?.dispose();
                modifiedListenerRef.current = editor.getModifiedEditor().onDidChangeModelContent(() => {
                    onModifiedChange?.(editor.getModifiedEditor().getValue());
                });
            }, theme: theme === "dark" ? "vs-dark" : "vs-light" }) }));
}
//# sourceMappingURL=code-diff-editor.js.map