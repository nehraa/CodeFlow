/**
 * codeflow-store wrapper
 * Local session storage, project-scoped state, checkpointing, approvals
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Checkpoint, SessionStore, PendingApproval, ApprovedItem } from '@/types/codeflow-store';

// Re-export types
export type { Checkpoint, PendingApproval, ApprovedItem };

interface SessionState {
  checkpoints: Checkpoint[];
  pendingApprovals: PendingApproval[];
  approvedItems: ApprovedItem[];
  addCheckpoint: (data: any, label?: string) => string;
  approveItem: (id: string) => void;
  rejectItem: (id: string) => void;
  getCheckpoint: (id: string) => Checkpoint | undefined;
  getCheckpointsByTag: (tag: string) => Checkpoint[];
  clearCheckpoints: () => void;
  clearAll: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      checkpoints: [],
      pendingApprovals: [],
      approvedItems: [],

      addCheckpoint: (data: any, label?: string) => {
        const id = `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const checkpoint: Checkpoint = {
          id,
          timestamp: Date.now(),
          data,
          label,
        };
        set((state) => ({
          checkpoints: [...state.checkpoints, checkpoint],
        }));
        return id;
      },

      approveItem: (id: string) => {
        const state = get();
        const item = state.pendingApprovals.find((p) => p.id === id);
        if (item) {
          set((state) => ({
            approvedItems: [
              ...state.approvedItems,
              {
                id: item.id,
                type: item.type,
                content: item.content,
                approvedAt: Date.now(),
              },
            ],
            pendingApprovals: state.pendingApprovals.filter((p) => p.id !== id),
          }));
        }
      },

      rejectItem: (id: string) => {
        set((state) => ({
          pendingApprovals: state.pendingApprovals.filter((p) => p.id !== id),
        }));
      },

      getCheckpoint: (id: string) => {
        return get().checkpoints.find((cp) => cp.id === id);
      },

      getCheckpointsByTag: (tag: string) => {
        return get().checkpoints.filter((cp) => cp.metadata?.tags?.includes(tag));
      },

      clearCheckpoints: () => {
        set({ checkpoints: [] });
      },

      clearAll: () => {
        set({
          checkpoints: [],
          pendingApprovals: [],
          approvedItems: [],
        });
      },
    }),
    {
      name: 'codeflow-session',
    }
  )
);

// Additional utilities
export function getSessionStorage() {
  return {
    save: (key: string, value: any) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(value));
      }
    },
    load: (key: string) => {
      if (typeof window !== 'undefined') {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      return null;
    },
    remove: (key: string) => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    },
  };
}

// Project-scoped storage
export function createProjectStore(projectId: string) {
  return create<SessionState>()(
    persist(
      (set, get) => ({
        checkpoints: [],
        pendingApprovals: [],
        approvedItems: [],

        addCheckpoint: (data: any, label?: string) => {
          const id = `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const checkpoint: Checkpoint = {
            id,
            timestamp: Date.now(),
            data,
            label,
            metadata: { projectId },
          };
          set((state) => ({
            checkpoints: [...state.checkpoints, checkpoint],
          }));
          return id;
        },

        approveItem: (id: string) => {
          const state = get();
          const item = state.pendingApprovals.find((p) => p.id === id);
          if (item) {
            set((state) => ({
              approvedItems: [
                ...state.approvedItems,
                {
                  id: item.id,
                  type: item.type,
                  content: item.content,
                  approvedAt: Date.now(),
                },
              ],
              pendingApprovals: state.pendingApprovals.filter((p) => p.id !== id),
            }));
          }
        },

        rejectItem: (id: string) => {
          set((state) => ({
            pendingApprovals: state.pendingApprovals.filter((p) => p.id !== id),
          }));
        },

        getCheckpoint: (id: string) => {
          return get().checkpoints.find((cp) => cp.id === id);
        },

        getCheckpointsByTag: (tag: string) => {
          return get().checkpoints.filter((cp) => cp.metadata?.tags?.includes(tag));
        },

        clearCheckpoints: () => {
          set({ checkpoints: [] });
        },

        clearAll: () => {
          set({
            checkpoints: [],
            pendingApprovals: [],
            approvedItems: [],
          });
        },
      }),
      {
        name: `codeflow-session-${projectId}`,
      }
    )
  );
}