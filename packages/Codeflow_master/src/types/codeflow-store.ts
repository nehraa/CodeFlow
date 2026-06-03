/**
 * Type definitions for @abhinav2203/codeflow-store
 * Local session storage, project-scoped state, checkpointing, approvals
 */

export interface Checkpoint {
  id: string;
  timestamp: number;
  data: any;
  label?: string;
  metadata?: {
    userId?: string;
    projectId?: string;
    tags?: string[];
  };
}

export interface SessionStore {
  checkpoints: Checkpoint[];
  pendingApprovals: PendingApproval[];
  approvedItems: ApprovedItem[];
  addCheckpoint(data: any, label?: string): void;
  approveItem(id: string): void;
  getCheckpoint(id: string): Checkpoint | undefined;
  clearCheckpoints(): void;
  getCheckpointsByTag(tag: string): Checkpoint[];
}

export interface PendingApproval {
  id: string;
  type: 'code' | 'comment' | 'file';
  content: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  createdBy?: string;
}

export interface ApprovedItem {
  id: string;
  type: 'code' | 'comment' | 'file';
  content: any;
  approvedAt: number;
  approvedBy?: string;
}

export interface ProjectState {
  projectId: string;
  name: string;
  checkpoints: Checkpoint[];
  currentCheckpoint: string | null;
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
  };
}

export interface StorageAdapter {
  save(key: string, value: any): Promise<void>;
  load(key: string): Promise<any | null>;
  remove(key: string): Promise<void>;
  list(): Promise<string[]>;
}