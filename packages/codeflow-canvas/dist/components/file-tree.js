"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import path from "node:path";
import { useCallback, useEffect, useState } from "react";
import { useBlueprintStore } from "../store/blueprint-store.js";
const FILE_LIST_API_ENDPOINT = "/api/files/list";
async function fetchFileList(directoryPath, repoPath) {
    const headers = { "content-type": "application/json" };
    if (repoPath) {
        headers["x-codeflow-repo-path"] = repoPath;
    }
    const response = await fetch(FILE_LIST_API_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ path: directoryPath })
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch file list: ${response.statusText}`);
    }
    return (await response.json());
}
function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}
function createInitialRoot(repoPath) {
    return {
        path: ".",
        name: repoPath ? path.basename(repoPath) : "workspace",
        isDirectory: true,
        isExpanded: true,
        isLoading: true,
        children: undefined
    };
}
function getFileBadge(name) {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
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
            return "·";
    }
}
function FileTreeItem({ node, depth, onToggle, onSelect, selectedPath }) {
    const indentationStyle = { paddingLeft: `${depth * 16 + 8}px` };
    return (_jsxs("div", { className: "file-tree-item", children: [_jsxs("div", { "aria-expanded": node.isDirectory ? node.isExpanded : undefined, "aria-selected": !node.isDirectory ? node.path === selectedPath : undefined, className: `file-tree-row ${node.isDirectory ? "directory" : "file"} ${!node.isDirectory ? "selectable" : ""}`, onClick: () => (node.isDirectory ? onToggle(node.path) : onSelect(node.path)), onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        if (node.isDirectory) {
                            onToggle(node.path);
                        }
                        else {
                            onSelect(node.path);
                        }
                    }
                }, role: "treeitem", style: indentationStyle, tabIndex: 0, children: [node.isDirectory ? (_jsx("span", { className: `file-tree-chevron ${node.isExpanded ? "expanded" : ""}`, children: node.isLoading ? "◌" : node.isExpanded ? "▼" : "▶" })) : null, _jsx("span", { className: `file-tree-icon ${node.isDirectory ? "is-directory" : "is-file"}`, children: node.isDirectory ? (node.isExpanded ? "dir" : "dir") : getFileBadge(node.name) }), _jsx("span", { className: `file-tree-name ${!node.isDirectory ? "file-name" : ""}`, children: node.name })] }), node.isDirectory && node.isExpanded ? (_jsx("div", { className: "file-tree-children", role: "group", children: node.isLoading ? (_jsx("div", { className: "file-tree-loading", style: indentationStyle, children: "Loading..." })) : node.error ? (_jsx("div", { className: "file-tree-error", style: indentationStyle, children: node.error })) : node.children?.length ? (node.children.map((child) => (_jsx(FileTreeItem, { depth: depth + 1, node: child, onSelect: onSelect, onToggle: onToggle, selectedPath: selectedPath }, child.path)))) : (_jsx("div", { className: "file-tree-empty", style: indentationStyle, children: "Empty folder" })) })) : null] }));
}
export function FileTree({ onFileSelect, selectedPath }) {
    const { repoPath } = useBlueprintStore();
    const [rootNode, setRootNode] = useState(() => createInitialRoot(repoPath));
    useEffect(() => {
        let cancelled = false;
        void fetchFileList(".", repoPath)
            .then((entries) => {
            if (cancelled) {
                return;
            }
            setRootNode({
                ...createInitialRoot(repoPath),
                isLoading: false,
                children: sortEntries(entries).map((entry) => ({
                    ...entry,
                    isExpanded: false,
                    isLoading: false
                }))
            });
        })
            .catch((error) => {
            if (cancelled) {
                return;
            }
            setRootNode({
                ...createInitialRoot(repoPath),
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to load"
            });
        });
        return () => {
            cancelled = true;
        };
    }, [repoPath]);
    const expandNode = useCallback((pathToExpand) => {
        setRootNode((prevRoot) => {
            const updateNode = (node) => {
                if (node.path !== pathToExpand) {
                    if (node.children) {
                        return { ...node, children: node.children.map(updateNode) };
                    }
                    return node;
                }
                if (!node.isDirectory || node.isLoading) {
                    return node;
                }
                if (node.children !== undefined) {
                    return { ...node, isExpanded: !node.isExpanded };
                }
                void (async () => {
                    try {
                        const files = sortEntries(await fetchFileList(pathToExpand, repoPath));
                        setRootNode((currentRoot) => {
                            const withChildren = (currentNode) => {
                                if (currentNode.path !== pathToExpand) {
                                    if (currentNode.children) {
                                        return { ...currentNode, children: currentNode.children.map(withChildren) };
                                    }
                                    return currentNode;
                                }
                                return {
                                    ...currentNode,
                                    error: undefined,
                                    isExpanded: true,
                                    isLoading: false,
                                    children: files.map((file) => ({
                                        ...file,
                                        isExpanded: false,
                                        isLoading: false
                                    }))
                                };
                            };
                            return withChildren(currentRoot);
                        });
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : "Failed to load";
                        setRootNode((currentRoot) => {
                            const withError = (currentNode) => {
                                if (currentNode.path !== pathToExpand) {
                                    if (currentNode.children) {
                                        return { ...currentNode, children: currentNode.children.map(withError) };
                                    }
                                    return currentNode;
                                }
                                return {
                                    ...currentNode,
                                    error: errorMessage,
                                    isExpanded: true,
                                    isLoading: false
                                };
                            };
                            return withError(currentRoot);
                        });
                    }
                })();
                return { ...node, error: undefined, isExpanded: true, isLoading: true };
            };
            return updateNode(prevRoot);
        });
    }, [repoPath]);
    return (_jsx("div", { className: "file-tree", role: "tree", children: _jsx(FileTreeItem, { depth: 0, node: rootNode, onSelect: onFileSelect, onToggle: expandNode, selectedPath: selectedPath }) }));
}
//# sourceMappingURL=file-tree.js.map