"use client";

import { useRef } from "react";

import dynamic from "next/dynamic";
import type * as Monaco from "monaco-editor";

import { prepareMonaco, toMonacoPath } from "./monaco-setup";

const MonacoDiffEditor = dynamic(() => import("@monaco-editor/react").then(mod => mod.DiffEditor), {
  ssr: false,
  loading: () => <div className="code-diff-editor-loading">Loading diff editor...</div>
});

type CodeDiffEditorProps = {
  originalValue: string;
  modifiedValue: string;
  language?: "typescript" | "javascript" | "json" | "markdown";
  height?: string;
  readOnly?: boolean;
  theme?: "light" | "dark";
  onModifiedChange?: (value: string) => void;
};

export function CodeDiffEditor({
  originalValue,
  modifiedValue,
  language = "typescript",
  height = "28rem",
  readOnly = false,
  theme = "dark",
  onModifiedChange
}: CodeDiffEditorProps): React.JSX.Element {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const modifiedListenerRef = useRef<Monaco.IDisposable | null>(null);

  return (
    <div
      className="code-diff-editor-shell"
      style={{
        height,
        minHeight: height === "100%" ? 0 : height
      }}
    >
      <MonacoDiffEditor
        beforeMount={prepareMonaco}
        height={height}
        language={language}
        modified={modifiedValue}
        modifiedModelPath={toMonacoPath("diff/modified.ts")}
        options={{
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
        }}
        original={originalValue}
        originalModelPath={toMonacoPath("diff/original.ts")}
        onMount={(editor, monaco) => {
          monacoRef.current = monaco;
          modifiedListenerRef.current?.dispose();
          modifiedListenerRef.current = editor.getModifiedEditor().onDidChangeModelContent(() => {
            onModifiedChange?.(editor.getModifiedEditor().getValue());
          });
        }}
        theme={theme === "dark" ? "vs-dark" : "vs-light"}
      />
    </div>
  );
}
