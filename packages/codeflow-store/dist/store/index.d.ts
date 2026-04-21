import type { BlueprintGraph, BlueprintNode } from "@abhinav2203/codeflow-core/schema";
type GraphStateUpdater = BlueprintGraph | null | ((current: BlueprintGraph | null) => BlueprintGraph | null);
type NodeUpdater = Partial<BlueprintNode> | ((node: BlueprintNode) => BlueprintNode);
export type WorkbenchMode = "graph" | "ide";
export interface FloatingGraphPanel {
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface BlueprintStore {
    graph: BlueprintGraph | null;
    setGraph: (next: GraphStateUpdater) => void;
    updateNode: (id: string, patch: NodeUpdater) => void;
    openFiles: string[];
    activeFile: string | null;
    setOpenFiles: (paths: string[]) => void;
    setActiveFile: (path: string | null) => void;
    closeFile: (path: string) => void;
    repoPath: string | null;
    setRepoPath: (path: string | null) => void;
    mode: WorkbenchMode;
    setMode: (mode: WorkbenchMode) => void;
    floatingGraph: FloatingGraphPanel;
    setFloatingGraph: (panel: Partial<FloatingGraphPanel>) => void;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
    dirtyFiles: Record<string, boolean>;
    setFileDirty: (path: string, dirty: boolean) => void;
    clearFileDirty: (path: string) => void;
}
export declare const useBlueprintStore: import("zustand").UseBoundStore<import("zustand").StoreApi<BlueprintStore>>;
export {};
//# sourceMappingURL=index.d.ts.map