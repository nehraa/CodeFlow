"use client";

import { useCallback, useEffect, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { FileTree } from "@/components/file-tree";
import { useBlueprintStore } from "@/store/blueprint-store";

const LANGUAGE_MAP: Record<string, "typescript" | "javascript" | "json" | "markdown"> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown"
};

function getLanguageFromPath(filePath: string): "typescript" | "javascript" | "json" | "markdown" {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext] ?? "typescript";
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

export function FileTabs(): JSX.Element {
  const { openFiles, activeFile, setActiveFile, closeFile, setOpenFiles } = useBlueprintStore();
  const [fileContents, setFileContents] = useState<Record<string, string>>({});

  const handleFileSelect = useCallback((path: string) => {
    setOpenFiles([...new Set([...openFiles, path])]);
    setActiveFile(path);
  }, [openFiles, setOpenFiles, setActiveFile]);

  const handleCloseFile = useCallback((path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    closeFile(path);
  }, [closeFile]);

  const handleTabClick = useCallback((path: string) => {
    setActiveFile(path);
  }, [setActiveFile]);

  const handleContentChange = useCallback((path: string, value: string) => {
    setFileContents((prev) => ({ ...prev, [path]: value }));
  }, []);

  useEffect(() => {
    if (!activeFile) return;

    if (!(activeFile in fileContents)) {
      fetch("/api/files/get", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: activeFile })
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch file");
          return res.json();
        })
        .then((data) => {
          setFileContents((prev) => ({ ...prev, [activeFile]: data.content ?? "" }));
        })
        .catch(() => {
          setFileContents((prev) => ({ ...prev, [activeFile]: `// Error loading: ${activeFile}` }));
        });
    }
  }, [activeFile, fileContents]);

  return (
    <div className="file-tabs-container">
      <div className="file-tree-panel">
        <FileTree onFileSelect={handleFileSelect} selectedPath={activeFile ?? undefined} />
      </div>

      <div className="editor-panel">
        <div className="tab-bar" role="tablist">
          {openFiles.length === 0 ? (
            <div className="no-tabs">No files open</div>
          ) : (
            openFiles.map((path) => (
              <div key={path} className={`tab ${path === activeFile ? "active" : ""}`}>
                <button
                  className="tab-content"
                  onClick={() => handleTabClick(path)}
                  role="tab"
                  aria-selected={path === activeFile}
                  type="button"
                >
                  <span className="tab-icon">
                    {path.endsWith(".tsx") || path.endsWith(".ts") ? "📘" :
                     path.endsWith(".js") || path.endsWith(".jsx") ? "📒" :
                     path.endsWith(".json") ? "📋" :
                     path.endsWith(".md") ? "📝" : "📄"}
                  </span>
                  <span className="tab-name">{getFileName(path)}</span>
                </button>
                <button
                  className="tab-close"
                  onClick={(e) => handleCloseFile(path, e)}
                  type="button"
                  aria-label={`Close ${getFileName(path)}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="editor-content">
          {activeFile ? (
            <CodeEditor
              path={activeFile}
              value={fileContents[activeFile] ?? "// Loading..."}
              onChange={(value) => handleContentChange(activeFile, value)}
              language={getLanguageFromPath(activeFile)}
              height="100%"
            />
          ) : (
            <div className="empty-editor">
              <p>Select a file from the sidebar to open it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
