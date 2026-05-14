import { create } from 'zustand';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { SyncEngine } from '../sync/SyncEngine';

export interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;

  triggerSync: () => Promise<void>;
  refreshPendingCount: () => void;
  setLastError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,

  triggerSync: async () => {
    const { isSyncing } = get();
    if (isSyncing) {
      return;
    }

    set({ isSyncing: true, lastError: null });

    try {
      const result = await SyncEngine.fullSync();
      set({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        lastError: result.errors.length > 0 ? result.errors[0] : null,
      });
      get().refreshPendingCount();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      set({ isSyncing: false, lastError: message });
    }
  },

  refreshPendingCount: () => {
    const count = SyncQueueRepository.getPendingCount();
    set({ pendingCount: count });
  },

  setLastError: (error) => set({ lastError: error }),
}));
