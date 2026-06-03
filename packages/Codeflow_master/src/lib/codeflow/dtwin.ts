/**
 * codeflow-dtwin wrapper
 * Digital twin simulation engine with active nodes and snapshot tooling
 */
import type { TwinSnapshot, TwinNode, TwinState, TwinConnection, DigitalTwinEngine } from '@/types/codeflow-dtwin';

// Re-export types
export type { TwinSnapshot, TwinNode, TwinState, TwinConnection };

class DigitalTwinEngineImpl implements DigitalTwinEngine {
  private nodes: Map<string, TwinNode> = new Map();
  private connections: Map<string, TwinConnection> = new Map();
  private snapshots: TwinSnapshot[] = [];
  private syncing: boolean = false;
  private updateListeners: ((event: any) => void)[] = [];

  async initialize(): Promise<void> {
    console.log('[codeflow-dtwin] Digital twin engine initialized');
  }

  addNode(node: Omit<TwinNode, 'id'>): TwinNode {
    const id = `twin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNode: TwinNode = { ...node, id };
    this.nodes.set(id, newNode);
    this.emitUpdate({ type: 'node_added', nodeId: id, timestamp: Date.now() });
    return newNode;
  }

  removeNode(id: string): void {
    if (this.nodes.has(id)) {
      this.nodes.delete(id);
      // Remove related connections
      for (const [connId, conn] of this.connections) {
        if (conn.sourceId === id || conn.targetId === id) {
          this.connections.delete(connId);
        }
      }
      this.emitUpdate({ type: 'node_removed', nodeId: id, timestamp: Date.now() });
    }
  }

  updateNodeState(id: string, state: Record<string, any>): void {
    const node = this.nodes.get(id);
    if (node) {
      node.state = { ...node.state, ...state };
      this.emitUpdate({ type: 'state_updated', nodeId: id, timestamp: Date.now() });
    }
  }

  getNode(id: string): TwinNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): TwinNode[] {
    return Array.from(this.nodes.values());
  }

  createSnapshot(label?: string): TwinSnapshot {
    const snapshot: TwinSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      state: this.captureState(),
      label,
    };
    this.snapshots.push(snapshot);
    this.emitUpdate({ type: 'snapshot_created', snapshotId: snapshot.id, timestamp: Date.now() });
    return snapshot;
  }

  restoreSnapshot(snapshotId: string): void {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);
    if (snapshot) {
      this.restoreState(snapshot.state);
      this.emitUpdate({ type: 'snapshot_restored', snapshotId, timestamp: Date.now() });
    }
  }

  getSnapshots(): TwinSnapshot[] {
    return [...this.snapshots];
  }

  deleteSnapshot(snapshotId: string): void {
    this.snapshots = this.snapshots.filter((s) => s.id !== snapshotId);
  }

  async sync(): Promise<void> {
    this.syncing = true;
    this.emitUpdate({ type: 'sync_started', timestamp: Date.now() });

    // Simulate sync delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    this.syncing = false;
    this.emitUpdate({ type: 'sync_completed', timestamp: Date.now() });
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  connect(sourceId: string, targetId: string, type: 'data' | 'control' = 'data'): TwinConnection {
    const id = `conn-${Date.now()}`;
    const connection: TwinConnection = {
      id,
      sourceId,
      targetId,
      type,
      weight: 1.0,
    };
    this.connections.set(id, connection);

    // Update node connections
    const source = this.nodes.get(sourceId);
    if (source) {
      source.connections.push(id);
    }

    return connection;
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      // Remove from source node
      const source = this.nodes.get(conn.sourceId);
      if (source) {
        source.connections = source.connections.filter((id) => id !== connectionId);
      }
      this.connections.delete(connectionId);
    }
  }

  getConnections(): TwinConnection[] {
    return Array.from(this.connections.values());
  }

  onUpdate(callback: (event: any) => void): () => void {
    this.updateListeners.push(callback);
    return () => {
      this.updateListeners = this.updateListeners.filter((cb) => cb !== callback);
    };
  }

  private captureState(): TwinState {
    return {
      nodes: this.getAllNodes(),
      connections: this.getConnections(),
      variables: {},
      timestamp: Date.now(),
    };
  }

  private restoreState(state: TwinState): void {
    this.nodes.clear();
    this.connections.clear();

    for (const node of state.nodes) {
      this.nodes.set(node.id, node);
    }
    for (const conn of state.connections) {
      this.connections.set(conn.id, conn);
    }
  }

  private emitUpdate(event: any): void {
    for (const listener of this.updateListeners) {
      listener(event);
    }
  }
}

// Singleton
let dtwin: DigitalTwinEngine | null = null;

export function getDigitalTwin(): DigitalTwinEngine {
  if (!dtwin) {
    dtwin = new DigitalTwinEngineImpl();
  }
  return dtwin;
}

// React hook for digital twin
export function useDigitalTwin() {
  const engine = getDigitalTwin();

  return {
    nodes: engine.getAllNodes(),
    connections: engine.getConnections(),
    snapshots: engine.getSnapshots(),
    isSyncing: engine.isSyncing(),
    addNode: engine.addNode.bind(engine),
    removeNode: engine.removeNode.bind(engine),
    updateNodeState: engine.updateNodeState.bind(engine),
    createSnapshot: engine.createSnapshot.bind(engine),
    restoreSnapshot: engine.restoreSnapshot.bind(engine),
    sync: () => engine.sync(),
    connect: engine.connect.bind(engine),
    disconnect: engine.disconnect.bind(engine),
  };
}