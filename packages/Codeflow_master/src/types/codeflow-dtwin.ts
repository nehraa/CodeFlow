/**
 * Type definitions for @abhinav2203/codeflow-dtwin
 * Digital twin simulation engine with active nodes and snapshot tooling
 */

export interface TwinSnapshot {
  id: string;
  timestamp: number;
  state: TwinState;
  label?: string;
  metadata?: {
    author?: string;
    tags?: string[];
    duration?: number;
  };
}

export interface TwinState {
  nodes: TwinNode[];
  connections: TwinConnection[];
  variables: Record<string, any>;
  timestamp: number;
}

export interface TwinNode {
  id: string;
  type: string;
  label?: string;
  state: Record<string, any>;
  position?: { x: number; y: number };
  connections: string[];
  metadata?: Record<string, any>;
}

export interface TwinConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type?: 'data' | 'control' | 'bidirectional';
  weight?: number;
  metadata?: Record<string, any>;
}

export interface DigitalTwinEngine {
  initialize(): Promise<void>;
  addNode(node: Omit<TwinNode, 'id'>): TwinNode;
  removeNode(id: string): void;
  updateNodeState(id: string, state: Record<string, any>): void;
  getNode(id: string): TwinNode | undefined;
  getAllNodes(): TwinNode[];
  createSnapshot(label?: string): TwinSnapshot;
  restoreSnapshot(snapshotId: string): void;
  getSnapshots(): TwinSnapshot[];
  deleteSnapshot(snapshotId: string): void;
  sync(): Promise<void>;
  isSyncing(): boolean;
  connect(sourceId: string, targetId: string, type?: 'data' | 'control'): TwinConnection;
  disconnect(connectionId: string): void;
  getConnections(): TwinConnection[];
}

export interface SimulationConfig {
  timestep?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
  enableVisualization?: boolean;
}

export interface SimulationResult {
  success: boolean;
  iterations: number;
  finalState: TwinState;
  convergenceHistory?: number[];
  duration: number;
}

export interface TwinEvent {
  type: 'node_added' | 'node_removed' | 'state_updated' | 'snapshot_created' | 'sync_started' | 'sync_completed';
  nodeId?: string;
  snapshotId?: string;
  timestamp: number;
}

export interface TwinMetrics {
  totalNodes: number;
  totalConnections: number;
  totalSnapshots: number;
  lastSyncTime?: number;
  simulationIterations?: number;
}