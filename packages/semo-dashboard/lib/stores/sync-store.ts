import { create } from 'zustand';
import type { SyncFlow, SyncStatus, SyncTrigger, SyncDirection } from '@/types';

interface SyncStore {
  flows: SyncFlow[];
  status: SyncStatus | null;
  selectedFlowId: string | null;
  selectedDirection: SyncDirection | null;
  highlightTrigger: SyncTrigger | null;
  setFlows: (flows: SyncFlow[]) => void;
  setStatus: (status: SyncStatus) => void;
  selectFlow: (id: string | null) => void;
  selectDirection: (dir: SyncDirection | null) => void;
  setHighlightTrigger: (trigger: SyncTrigger | null) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  flows: [],
  status: null,
  selectedFlowId: null,
  selectedDirection: null,
  highlightTrigger: null,
  setFlows: (flows) => set({ flows }),
  setStatus: (status) => set({ status }),
  selectFlow: (id) => set({ selectedFlowId: id }),
  selectDirection: (dir) => set({ selectedDirection: dir, selectedFlowId: null }),
  setHighlightTrigger: (trigger) => set({ highlightTrigger: trigger }),
}));
