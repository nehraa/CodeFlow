"use client";

import type * as Monaco from "monaco-editor";

import { getTypeScriptLanguageService } from "@/components/ts-language-service";

type MonacoEnvironmentShape = {
  getWorker: (_workerId: string, label: string) => Worker;
};

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: MonacoEnvironmentShape;
};

let workersConfigured = false;

export function prepareMonaco(monaco: typeof Monaco): void {
  if (!workersConfigured) {
    const monacoGlobal = globalThis as MonacoGlobal;
    monacoGlobal.MonacoEnvironment = {
      getWorker(_workerId, label) {
        if (label === "typescript" || label === "javascript") {
          return new Worker(
            new URL("monaco-editor/esm/vs/language/typescript/ts.worker.js", import.meta.url),
            { type: "module" }
          );
        }

        if (label === "json") {
          return new Worker(
            new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url),
            { type: "module" }
          );
        }

        if (label === "css" || label === "scss" || label === "less") {
          return new Worker(
            new URL("monaco-editor/esm/vs/language/css/css.worker.js", import.meta.url),
            { type: "module" }
          );
        }

        if (label === "html" || label === "handlebars" || label === "razor") {
          return new Worker(
            new URL("monaco-editor/esm/vs/language/html/html.worker.js", import.meta.url),
            { type: "module" }
          );
        }

        return new Worker(
          new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
          { type: "module" }
        );
      }
    };
    workersConfigured = true;
  }

  getTypeScriptLanguageService(monaco).configureDefaults();
}

export function toMonacoPath(filePath: string): string {
  if (filePath.startsWith("file://")) {
    return filePath;
  }

  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `file:///${normalized}`;
}
