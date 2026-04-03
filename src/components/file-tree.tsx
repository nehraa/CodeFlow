"use client";

import { useCallback, useState } from "react";

import { useBlueprintStore } from "@/store/blueprint-store";

type FileNode = {
  path: string;
  name: string;
  isDirectory: boolean;
};

type FileTreeNode = FileNode & {
  children?: FileTreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
  error?: string;
};

type FileTreeProps = {
  onFileSelect: (path: string) => void;
  selectedPath?: string;
};

const FILE_LIST_API_ENDPOINT = "/api/files/list";

async function fetchFileList(directoryPath: string, repoPath: string | null): Promise<FileNode[]> {
  const headers: Record<string, string> = { "content-type": "application/json" };
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

  const data = (await response.json()) as FileNode[];
  return data;
}

function FileTreeItem({
  node,
  depth,
  onToggle,
  onSelect,
  selectedPath
}: {
  node: FileTreeNode;
  depth: number;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  selectedPath?: string;
}): JSX.Element {
  const handleToggle = useCallback(() => {
    onToggle(node.path);
  }, [onToggle, node.path]);

  const handleSelect = useCallback(() => {
    if (!node.isDirectory) {
      onSelect(node.path);
    }
  }, [onSelect, node.path, node.isDirectory]);

  const indentationStyle = { paddingLeft: `${depth * 16 + 8}px` };

  return (
    <div className="file-tree-item">
      <div
        className={`file-tree-row ${node.isDirectory ? "directory" : "file"} ${!node.isDirectory ? "selectable" : ""}`}
        style={indentationStyle}
        onClick={node.isDirectory ? handleToggle : handleSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (node.isDirectory) {
              handleToggle();
            } else {
              handleSelect();
            }
          }
        }}
        role="treeitem"
        tabIndex={0}
        aria-expanded={node.isDirectory ? node.isExpanded : undefined}
        aria-selected={!node.isDirectory ? node.path === selectedPath : undefined}
      >
        {node.isDirectory && (
          <span className={`file-tree-chevron ${node.isExpanded ? "expanded" : ""}`}>
            {node.isLoading ? "◌" : node.isExpanded ? "▼" : "▶"}
          </span>
        )}
        <span className="file-tree-icon">
          {node.isDirectory ? (node.isExpanded ? "📂" : "📁") : "📄"}
        </span>
        <span className={`file-tree-name ${!node.isDirectory ? "file-name" : ""}`}>
          {node.name}
        </span>
      </div>

      {node.isDirectory && node.isExpanded && (
        <div className="file-tree-children" role="group">
          {node.isLoading ? (
            <div className="file-tree-loading" style={indentationStyle}>
              Loading...
            </div>
          ) : node.error ? (
            <div className="file-tree-error" style={indentationStyle}>
              {node.error}
            </div>
          ) : node.children && node.children.length > 0 ? (
            node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedPath={selectedPath}
              />
            ))
          ) : (
            <div className="file-tree-empty" style={indentationStyle}>
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({ onFileSelect, selectedPath }: FileTreeProps): JSX.Element {
  const { repoPath } = useBlueprintStore();
  const [rootNode, setRootNode] = useState<FileTreeNode>({
    path: ".",
    name: "root",
    isDirectory: true,
    isExpanded: false,
    isLoading: false,
    children: undefined
  });

  const expandNode = useCallback(async (path: string) => {
    setRootNode((prevRoot) => {
      const updateNode = (node: FileTreeNode): FileTreeNode => {
        if (node.path !== path) {
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
            const files = await fetchFileList(path, repoPath);
            const sortedFiles = files.sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });

            setRootNode((currentRoot) => {
              const updateWithChildren = (n: FileTreeNode): FileTreeNode => {
                if (n.path !== path) {
                  if (n.children) {
                    return { ...n, children: n.children.map(updateWithChildren) };
                  }
                  return n;
                }
                return {
                  ...n,
                  isExpanded: true,
                  isLoading: false,
                  children: sortedFiles.map((file) => ({
                    ...file,
                    isExpanded: false,
                    isLoading: false,
                    children: file.isDirectory ? undefined : undefined
                  }))
                };
              };
              return updateWithChildren(currentRoot);
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load";
            setRootNode((currentRoot) => {
              const updateWithError = (n: FileTreeNode): FileTreeNode => {
                if (n.path !== path) {
                  if (n.children) {
                    return { ...n, children: n.children.map(updateWithError) };
                  }
                  return n;
                }
                return {
                  ...n,
                  isLoading: false,
                  isExpanded: true,
                  error: errorMessage
                };
              };
              return updateWithError(currentRoot);
            });
          }
        })();

        return { ...node, isLoading: true, isExpanded: true };
      };

      return updateNode(prevRoot);
    });
  }, []);

  return (
    <div className="file-tree" role="tree">
      <FileTreeItem
        node={rootNode}
        depth={0}
        onToggle={expandNode}
        onSelect={onFileSelect}
        selectedPath={selectedPath}
      />
    </div>
  );
}
