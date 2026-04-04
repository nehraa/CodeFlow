"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import type { NavigationTarget } from "@/lib/blueprint/node-navigation";
import { useBlueprintStore } from "@/store/blueprint-store";

const LANGUAGE_MAP: Record<string, "typescript" | "javascript" | "json" | "markdown"> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown"
};

type FileRecord = Record<string, string>;

function getLanguageFromPath(filePath: string): "typescript" | "javascript" | "json" | "markdown" {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext] ?? "typescript";
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? filePath;
}

function getFileBadge(filePath: string): string {
  const extension = getFileName(filePath).split(".").pop()?.toLowerCase();
  switch (extension) {
    case "ts":
      return "TS";
    case "tsx":
      return "TSX";
    case "js":
      return "JS";
    case "jsx":
      return "JSX";
    case "json":
      return "{}";
    case "md":
      return "MD";
    default:
      return "FILE";
  }
}

function createRepoHeaders(repoPath: string | null): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (repoPath) {
    headers["x-codeflow-repo-path"] = repoPath;
  }

  return headers;
}

export function FileTabs({ revealTarget }: { revealTarget?: NavigationTarget | null }) {
  const {
    activeFile,
    clearFileDirty,
    closeFile,
    dirtyFiles,
    openFiles,
    repoPath,
    setActiveFile,
    setFileDirty
  } = useBlueprintStore();
  const [fileContents, setFileContents] = useState<FileRecord>({});
  const [savedContents, setSavedContents] = useState<FileRecord>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [savingFiles, setSavingFiles] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeFileContent = activeFile ? fileContents[activeFile] : undefined;
  const activeIsDirty = activeFile ? Boolean(dirtyFiles[activeFile]) : false;
  const activeIsSaving = activeFile ? Boolean(savingFiles[activeFile]) : false;

  const fetchFileContent = useCallback(
    async (path: string) => {
      setLoadingFiles((current) => ({ ...current, [path]: true }));
      setLoadError(null);

      try {
        const response = await fetch(`/api/files/get?path=${encodeURIComponent(path)}`, {
          headers: createRepoHeaders(repoPath)
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to load ${path}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        const content =
          contentType.includes("application/json")
            ? ((await response.json()) as { content?: string }).content ?? ""
            : await response.text();

        setFileContents((current) => ({ ...current, [path]: content }));
        setSavedContents((current) => ({ ...current, [path]: content }));
        clearFileDirty(path);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to load ${path}`;
        setLoadError(message);
      } finally {
        setLoadingFiles((current) => ({ ...current, [path]: false }));
      }
    },
    [clearFileDirty, repoPath]
  );

  useEffect(() => {
    if (!activeFile || activeFile in fileContents) {
      return;
    }

    void fetchFileContent(activeFile);
  }, [activeFile, fetchFileContent, fileContents]);

  useEffect(() => {
    setFileContents((current) => {
      const nextEntries = Object.fromEntries(
        Object.entries(current).filter(([path]) => openFiles.includes(path))
      );

      return Object.keys(nextEntries).length === Object.keys(current).length ? current : nextEntries;
    });

    setSavedContents((current) => {
      const nextEntries = Object.fromEntries(
        Object.entries(current).filter(([path]) => openFiles.includes(path))
      );

      return Object.keys(nextEntries).length === Object.keys(current).length ? current : nextEntries;
    });
  }, [openFiles]);

  const handleCloseFile = useCallback(
    (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      closeFile(path);
    },
    [closeFile]
  );

  const handleContentChange = useCallback(
    (path: string, value: string) => {
      setFileContents((current) => ({ ...current, [path]: value }));
      setFileDirty(path, value !== (savedContents[path] ?? ""));
    },
    [savedContents, setFileDirty]
  );

  const handleSave = useCallback(
    async (path: string) => {
      const content = fileContents[path];
      if (content === undefined) {
        return;
      }

      setSavingFiles((current) => ({ ...current, [path]: true }));
      setSaveError(null);

      try {
        const response = await fetch("/api/files/post", {
          method: "POST",
          headers: createRepoHeaders(repoPath),
          body: JSON.stringify({ path, content })
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to save ${path}`);
        }

        setSavedContents((current) => ({ ...current, [path]: content }));
        clearFileDirty(path);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : `Failed to save ${path}`);
      } finally {
        setSavingFiles((current) => ({ ...current, [path]: false }));
      }
    },
    [clearFileDirty, fileContents, repoPath]
  );

  const statusMessage = useMemo(() => {
    if (activeFile && loadingFiles[activeFile]) {
      return `Loading ${getFileName(activeFile)}...`;
    }
    if (loadError) {
      return loadError;
    }
    if (saveError) {
      return saveError;
    }
    if (!activeFile) {
      return "Select a file from the explorer to begin editing.";
    }
    if (activeIsSaving) {
      return `Saving ${getFileName(activeFile)}...`;
    }
    if (activeIsDirty) {
      return `${getFileName(activeFile)} has unsaved changes.`;
    }

    return `${getFileName(activeFile)} is synced with the repo.`;
  }, [activeFile, activeIsDirty, activeIsSaving, loadError, loadingFiles, saveError]);

  return (
    <div className="file-tabs-container">
      <div className="tab-bar" role="tablist">
        {openFiles.length === 0 ? (
          <div className="no-tabs">No files open</div>
        ) : (
          openFiles.map((path) => {
            const isActive = path === activeFile;
            const isDirty = Boolean(dirtyFiles[path]);

            return (
              <div key={path} className={`tab ${isActive ? "active" : ""}`}>
                <button
                  aria-selected={isActive}
                  className="tab-content"
                  onClick={() => setActiveFile(path)}
                  role="tab"
                  type="button"
                >
                  <span className="tab-icon" aria-hidden="true">{getFileBadge(path)}</span>
                  <span className="tab-name">{getFileName(path)}</span>
                  {isDirty ? <span className="tab-dirty" aria-label="Unsaved changes">●</span> : null}
                </button>
                <button
                  aria-label={`Close ${getFileName(path)}`}
                  className="tab-close"
                  onClick={(event) => handleCloseFile(path, event)}
                  type="button"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="editor-toolbar">
        <p className={`editor-status ${loadError || saveError ? "is-error" : ""}`}>{statusMessage}</p>
        {activeFile ? (
          <button
            className="editor-save-button"
            disabled={activeIsSaving || !activeIsDirty}
            onClick={() => void handleSave(activeFile)}
            type="button"
          >
            {activeIsSaving ? "Saving..." : activeIsDirty ? "Save" : "Saved"}
          </button>
        ) : null}
      </div>

      <div className="editor-content">
        {activeFile ? (
          activeFileContent !== undefined ? (
            <CodeEditor
              ariaLabel="Code editor"
              height="100%"
              language={getLanguageFromPath(activeFile)}
              onChange={(value) => handleContentChange(activeFile, value)}
              onSave={() => handleSave(activeFile)}
              path={activeFile}
              revealTarget={revealTarget?.filePath === activeFile ? revealTarget : null}
              value={activeFileContent}
            />
          ) : (
            <div className="empty-editor">
              <p>{loadingFiles[activeFile] ? `Loading ${getFileName(activeFile)}...` : "Preparing editor..."}</p>
            </div>
          )
        ) : (
          <div className="empty-editor">
            <p>Select a file from the explorer to open Monaco in the main area.</p>
          </div>
        )}
      </div>
    </div>
  );
}
