"use client";

import { useCallback, useEffect, useRef } from "react";

import dynamic from "next/dynamic";
import type * as Monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

import type { BlueprintGraph } from "@/lib/blueprint/schema";
import { getTypeScriptLanguageService } from "./ts-language-service";

// Configure Monaco workers before any Monaco initialization
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="code-editor-loading">Loading editor...</div>
});

type CodeEditorProps = {
  path: string;
  value: string;
  onChange: (value: string) => void;
  language?: "typescript" | "javascript" | "json" | "markdown";
  height?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  theme?: "light" | "dark";
  completionContext?: {
    enabled: boolean;
    graph: BlueprintGraph;
    nodeId: string;
    nvidiaApiKey?: string;
  };
};

type CompletionResponse = {
  suggestions: Array<{
    label: string;
    insertText: string;
    detail?: string;
    documentation?: string;
    kind?: string;
  }>;
};

const COMPLETION_TTL_MS = 15_000;
const COMPLETION_DEBOUNCE_MS = 220;

const toCompletionKind = (
  monaco: typeof Monaco,
  kind?: string
): Monaco.languages.CompletionItemKind => {
  switch (kind) {
    case "method":
      return monaco.languages.CompletionItemKind.Method;
    case "function":
      return monaco.languages.CompletionItemKind.Function;
    case "constructor":
      return monaco.languages.CompletionItemKind.Constructor;
    case "field":
      return monaco.languages.CompletionItemKind.Field;
    case "variable":
      return monaco.languages.CompletionItemKind.Variable;
    case "class":
      return monaco.languages.CompletionItemKind.Class;
    case "interface":
      return monaco.languages.CompletionItemKind.Interface;
    case "module":
      return monaco.languages.CompletionItemKind.Module;
    case "property":
      return monaco.languages.CompletionItemKind.Property;
    case "unit":
      return monaco.languages.CompletionItemKind.Unit;
    case "value":
      return monaco.languages.CompletionItemKind.Value;
    case "enum":
      return monaco.languages.CompletionItemKind.Enum;
    case "keyword":
      return monaco.languages.CompletionItemKind.Keyword;
    case "snippet":
      return monaco.languages.CompletionItemKind.Snippet;
    case "color":
      return monaco.languages.CompletionItemKind.Color;
    case "file":
      return monaco.languages.CompletionItemKind.File;
    case "reference":
      return monaco.languages.CompletionItemKind.Reference;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
};

export function CodeEditor({
  path,
  value,
  onChange,
  language = "typescript",
  height = "28rem",
  ariaLabel,
  readOnly = false,
  theme = "dark",
  completionContext
}: CodeEditorProps) {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const completionContextRef = useRef(completionContext);
  const providerRef = useRef<Monaco.IDisposable | null>(null);
  const cacheRef = useRef(
    new Map<string, { createdAt: number; suggestions: Monaco.languages.CompletionItem[] }>()
  );
  const inflightRef = useRef(new Map<string, Promise<Monaco.languages.CompletionItem[]>>());
  const debounceRef = useRef<{
    timer: number | null;
    resolve: ((ready: boolean) => void) | null;
  }>({
    timer: null,
    resolve: null
  });

  const waitForDebounce = () =>
    new Promise<boolean>((resolve) => {
      if (debounceRef.current.timer) {
        window.clearTimeout(debounceRef.current.timer);
        debounceRef.current.resolve?.(false);
      }

      debounceRef.current.resolve = resolve;
      debounceRef.current.timer = window.setTimeout(() => {
        debounceRef.current.timer = null;
        debounceRef.current.resolve = null;
        resolve(true);
      }, COMPLETION_DEBOUNCE_MS);
    });

  const registerCompletionProvider = useCallback(
    (monaco: typeof Monaco) => {
      providerRef.current?.dispose();

      if (readOnly || (language !== "typescript" && language !== "javascript")) {
        return;
      }

      providerRef.current = monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: [".", "("],
        provideCompletionItems: async (model, position, context) => {
          const activeContext = completionContextRef.current;
          if (!activeContext?.enabled) {
            return { suggestions: [] };
          }

          if (
            context.triggerKind === monaco.languages.CompletionTriggerKind.TriggerCharacter &&
            ![".", "("].includes(context.triggerCharacter ?? "")
          ) {
            return { suggestions: [] };
          }

          const word = model.getWordUntilPosition(position);
          const lineContent = model.getLineContent(position.lineNumber);
          const linePrefix = lineContent.slice(0, position.column - 1);
          const lineSuffix = lineContent.slice(position.column - 1);
          const currentCode = model.getValue();
          const cursorOffset = model.getOffsetAt(position);
          const recentPrefix = currentCode.slice(Math.max(0, cursorOffset - 180), cursorOffset);

          if (
            context.triggerKind !== monaco.languages.CompletionTriggerKind.TriggerCharacter &&
            recentPrefix.trim().length < 3
          ) {
            return { suggestions: [] };
          }

          const cacheKey = JSON.stringify([
            activeContext.nodeId,
            context.triggerCharacter ?? "manual",
            recentPrefix
          ]);
          const cached = cacheRef.current.get(cacheKey);

          if (cached && Date.now() - cached.createdAt < COMPLETION_TTL_MS) {
            return { suggestions: cached.suggestions };
          }

          const inflight = inflightRef.current.get(cacheKey);
          if (inflight) {
            return { suggestions: await inflight };
          }

          const shouldContinue = await waitForDebounce();
          if (!shouldContinue) {
            return { suggestions: [] };
          }

          const completionPromise = (async () => {
            try {
              const response = await fetch("/api/code-completions", {
                method: "POST",
                headers: {
                  "content-type": "application/json"
                },
                body: JSON.stringify({
                  graph: activeContext.graph,
                  nodeId: activeContext.nodeId,
                  currentCode,
                  cursorOffset,
                  linePrefix,
                  lineSuffix,
                  triggerCharacter: context.triggerCharacter ?? undefined,
                  nvidiaApiKey: activeContext.nvidiaApiKey
                })
              });

              if (!response.ok) {
                return [];
              }

              const body = (await response.json()) as CompletionResponse;
              const range = new monaco.Range(
                position.lineNumber,
                position.column - word.word.length,
                position.lineNumber,
                position.column
              );

              return body.suggestions.map((suggestion) => ({
                detail: suggestion.detail,
                documentation: suggestion.documentation,
                insertText: suggestion.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                kind: toCompletionKind(monaco, suggestion.kind),
                label: suggestion.label,
                range
              }));
            } catch {
              return [];
            }
          })();

          inflightRef.current.set(cacheKey, completionPromise);

          try {
            const suggestions = await completionPromise;
            cacheRef.current.set(cacheKey, {
              createdAt: Date.now(),
              suggestions
            });
            return { suggestions };
          } finally {
            inflightRef.current.delete(cacheKey);
          }
        }
      });
    },
    [language, readOnly]
  );

  useEffect(() => {
    completionContextRef.current = completionContext;
  }, [completionContext]);

  useEffect(() => {
    if (monacoRef.current) {
      registerCompletionProvider(monacoRef.current);
    }
  }, [language, readOnly, registerCompletionProvider]);

  useEffect(() => {
    const debounceState = debounceRef.current;

    return () => {
      providerRef.current?.dispose();

      if (debounceState.timer) {
        window.clearTimeout(debounceState.timer);
      }
      debounceState.resolve?.(false);
    };
  }, []);

  return (
    <div className="code-editor-shell">
      <MonacoEditor
        height={height}
        language={language}
        onMount={(_, monaco) => {
          monacoRef.current = monaco;
          registerCompletionProvider(monaco);
        }}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          ariaLabel: ariaLabel ?? path,
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
          wordWrap: "on"
        }}
        path={path}
        theme={theme === "dark" ? "vs-dark" : "vs-light"}
        value={value}
      />
    </div>
  );
}
