"use client";

import { useRef } from "react";

import dynamic from "next/dynamic";
import type * as Monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Configure Monaco workers before any Monaco initialization
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

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
}: CodeDiffEditorProps): JSX.Element {
  const monacoRef = useRef<typeof Monaco | null>(null);

  return (
    <div className="code-diff-editor-shell">
      <MonacoDiffEditor
        height={height}
        language={language}
        theme={theme === "dark" ? "vs-dark" : "vs-light"}
        original={originalValue}
        modified={modifiedValue}
        options={{
          automaticLayout: true,
          fontFamily: "IBM Plex Mono, SFMono-Regular, SF Mono, monospace",
          fontLigatures: true,
          fontSize: 14,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 16, bottom: 16 },
          readOnly,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
          wordWrap: "on",
          renderSideBySide: true,
          enableSplitViewResizing: true
        }}
        onMount={(_, monaco) => {
          monacoRef.current = monaco;
        }}
        onModifiedChange={(value) => {
          if (onModifiedChange) {
            onModifiedChange(value ?? "");
          }
        }}
      />
    </div>
  );
}