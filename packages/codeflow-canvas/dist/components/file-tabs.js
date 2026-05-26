"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CodeEditor } from "./code-editor.js";
import { useBlueprintStore } from "../store/blueprint-store.js";
const LANGUAGE_MAP = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".md": "markdown"
};
function getLanguageFromPath(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
    return LANGUAGE_MAP[ext] ?? "typescript";
}
function getFileName(filePath) {
    const parts = filePath.split(/[\\/]/);
    return parts[parts.length - 1] ?? filePath;
}
function getFileBadge(filePath) {
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
function createRepoHeaders(repoPath) {
    const headers = { "content-type": "application/json" };
    if (repoPath) {
        headers["x-codeflow-repo-path"] = repoPath;
    }
    return headers;
}
export function FileTabs({ revealTarget }) {
    const { activeFile, clearFileDirty, closeFile, dirtyFiles, openFiles, repoPath, setActiveFile, setFileDirty } = useBlueprintStore();
    const [fileContents, setFileContents] = useState({});
    const [savedContents, setSavedContents] = useState({});
    const [loadingFiles, setLoadingFiles] = useState({});
    const [savingFiles, setSavingFiles] = useState({});
    const [loadError, setLoadError] = useState(null);
    const [saveError, setSaveError] = useState(null);
    const activeFileContent = activeFile ? fileContents[activeFile] : undefined;
    const activeIsDirty = activeFile ? Boolean(dirtyFiles[activeFile]) : false;
    const activeIsSaving = activeFile ? Boolean(savingFiles[activeFile]) : false;
    const fetchFileContent = useCallback(async (path) => {
        setLoadingFiles((current) => ({ ...current, [path]: true }));
        setLoadError(null);
        try {
            const response = await fetch(`/api/files/get?path=${encodeURIComponent(path)}`, {
                headers: createRepoHeaders(repoPath)
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null));
                throw new Error(body?.error ?? `Failed to load ${path}`);
            }
            const contentType = response.headers.get("content-type") ?? "";
            const content = contentType.includes("application/json")
                ? (await response.json()).content ?? ""
                : await response.text();
            setFileContents((current) => ({ ...current, [path]: content }));
            setSavedContents((current) => ({ ...current, [path]: content }));
            clearFileDirty(path);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : `Failed to load ${path}`;
            setLoadError(message);
        }
        finally {
            setLoadingFiles((current) => ({ ...current, [path]: false }));
        }
    }, [clearFileDirty, repoPath]);
    useEffect(() => {
        if (!activeFile || activeFile in fileContents) {
            return;
        }
        void fetchFileContent(activeFile);
    }, [activeFile, fetchFileContent, fileContents]);
    useEffect(() => {
        setFileContents((current) => {
            const nextEntries = Object.fromEntries(Object.entries(current).filter(([path]) => openFiles.includes(path)));
            return Object.keys(nextEntries).length === Object.keys(current).length ? current : nextEntries;
        });
        setSavedContents((current) => {
            const nextEntries = Object.fromEntries(Object.entries(current).filter(([path]) => openFiles.includes(path)));
            return Object.keys(nextEntries).length === Object.keys(current).length ? current : nextEntries;
        });
    }, [openFiles]);
    const handleCloseFile = useCallback((path, event) => {
        event.stopPropagation();
        closeFile(path);
    }, [closeFile]);
    const handleContentChange = useCallback((path, value) => {
        setFileContents((current) => ({ ...current, [path]: value }));
        setFileDirty(path, value !== (savedContents[path] ?? ""));
    }, [savedContents, setFileDirty]);
    const handleSave = useCallback(async (path) => {
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
                const body = (await response.json().catch(() => null));
                throw new Error(body?.error ?? `Failed to save ${path}`);
            }
            setSavedContents((current) => ({ ...current, [path]: content }));
            clearFileDirty(path);
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : `Failed to save ${path}`);
        }
        finally {
            setSavingFiles((current) => ({ ...current, [path]: false }));
        }
    }, [clearFileDirty, fileContents, repoPath]);
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
    return (_jsxs("div", { className: "file-tabs-container", children: [_jsx("div", { className: "tab-bar", role: "tablist", children: openFiles.length === 0 ? (_jsx("div", { className: "no-tabs", children: "No files open" })) : (openFiles.map((path) => {
                    const isActive = path === activeFile;
                    const isDirty = Boolean(dirtyFiles[path]);
                    return (_jsxs("div", { className: `tab ${isActive ? "active" : ""}`, children: [_jsxs("button", { "aria-selected": isActive, className: "tab-content", onClick: () => setActiveFile(path), role: "tab", type: "button", children: [_jsx("span", { className: "tab-icon", "aria-hidden": "true", children: getFileBadge(path) }), _jsx("span", { className: "tab-name", children: getFileName(path) }), isDirty ? _jsx("span", { className: "tab-dirty", "aria-label": "Unsaved changes", children: "\u25CF" }) : null] }), _jsx("button", { "aria-label": `Close ${getFileName(path)}`, className: "tab-close", onClick: (event) => handleCloseFile(path, event), type: "button", children: "\u00D7" })] }, path));
                })) }), _jsxs("div", { className: "editor-toolbar", children: [_jsx("p", { className: `editor-status ${loadError || saveError ? "is-error" : ""}`, children: statusMessage }), activeFile ? (_jsx("button", { className: "editor-save-button", disabled: activeIsSaving || !activeIsDirty, onClick: () => void handleSave(activeFile), type: "button", children: activeIsSaving ? "Saving..." : activeIsDirty ? "Save" : "Saved" })) : null] }), _jsx("div", { className: "editor-content", children: activeFile ? (activeFileContent !== undefined ? (_jsx(CodeEditor, { ariaLabel: "Code editor", height: "100%", language: getLanguageFromPath(activeFile), onChange: (value) => handleContentChange(activeFile, value), onSave: () => handleSave(activeFile), path: activeFile, revealTarget: revealTarget?.filePath === activeFile ? revealTarget : null, value: activeFileContent })) : (_jsx("div", { className: "empty-editor", children: _jsx("p", { children: loadingFiles[activeFile] ? `Loading ${getFileName(activeFile)}...` : "Preparing editor..." }) }))) : (_jsx("div", { className: "empty-editor", children: _jsx("p", { children: "Select a file from the explorer to open Monaco in the main area." }) })) })] }));
}
//# sourceMappingURL=file-tabs.js.map