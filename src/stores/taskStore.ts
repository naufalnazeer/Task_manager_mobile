import { create } from 'zustand';
import {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStatus,
  serverTaskToLocal,
} from '../types/task';
import { TaskRepository } from '../repositories/TaskRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { TaskApi } from '../api/client';
import { useNetworkStore } from './networkStore';
import { useSyncStore } from './syncStore';

interface TaskState {
  tasks: Task[];
  searchResults: Task[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  filters: TaskFilters;

  // Actions
  loadTasks: () => void;
  searchTasks: (query: string) => void;
  clearSearch: () => void;
  createTask: (input: CreateTaskInput) => Task;
  updateTask: (id: string, input: UpdateTaskInput) => Task | null;
  deleteTask: (id: string) => boolean;
  getTask: (id: string) => Task | null;
  setFilters: (filters: TaskFilters) => void;
  pullFromServer: () => Promise<void>;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,
  error: null,
  filters: {},

  loadTasks: () => {
    set({ isLoading: true });
    try {
      const result = TaskRepository.findAll(get().filters);
      set({ tasks: result.data, isLoading: false });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load tasks';
      set({ error: msg, isLoading: false });
    }
  },

  searchTasks: (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = TaskRepository.search(query.trim(), get().filters);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], isSearching: false });
  },

  createTask: (input: CreateTaskInput): Task => {
    const task = TaskRepository.create(input);
    const isConnected = useNetworkStore.getState().isConnected;

    // Always enqueue for sync
    SyncQueueRepository.enqueueOrReplace(task.id, 'create', {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    });
    useSyncStore.getState().refreshPendingCount();

    // If online, trigger immediate sync
    if (isConnected) {
      syncCreateTask(task);
    }

    set(state => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: (id: string, input: UpdateTaskInput): Task | null => {
    const updated = TaskRepository.update(id, input);
    if (!updated) {
      return null;
    }

    const isConnected = useNetworkStore.getState().isConnected;

    SyncQueueRepository.enqueueOrReplace(id, 'update', input);
    useSyncStore.getState().refreshPendingCount();

    if (isConnected) {
      syncUpdateTask(id, input);
    }

    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? updated : t)),
    }));
    return updated;
  },

  deleteTask: (id: string): boolean => {
    const success = TaskRepository.softDelete(id);
    if (!success) {
      return false;
    }

    const isConnected = useNetworkStore.getState().isConnected;

    SyncQueueRepository.enqueueOrReplace(id, 'delete', { id });
    useSyncStore.getState().refreshPendingCount();

    if (isConnected) {
      syncDeleteTask(id);
    }

    set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }));
    return true;
  },

  getTask: (id: string): Task | null => {
    return TaskRepository.findById(id);
  },

  setFilters: (filters: TaskFilters) => {
    set({ filters });
    get().loadTasks();
  },

  pullFromServer: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await TaskApi.getAllTasks();
      if (result.success && result.data) {
        // Convert server tasks to local format and upsert
        for (const serverTask of result.data) {
          const localTask = serverTaskToLocal(serverTask);
          const existing = TaskRepository.findById(localTask.id);

          if (!existing) {
            TaskRepository.upsertFromServer(localTask);
          } else if (!existing.needsSync) {
            // Only overwrite if local doesn't have pending changes
            TaskRepository.upsertFromServer(localTask);
          }
          // If local has pending changes, keep local version (conflict avoidance)
        }

        // Reload from DB
        get().loadTasks();
      } else {
        set({ error: result.error, isLoading: false });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Pull failed';
      set({ error: msg, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// ─── Background sync helpers (fire-and-forget) ──────────────────────────────

async function syncCreateTask(task: Task): Promise<void> {
  try {
    const result = await TaskApi.createTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    });

    if (result.success && result.data) {
      // Update local task with server ID if different
      const serverId = result.data._id;
      if (serverId !== task.id) {
        TaskRepository.updateServerId(task.id, serverId);
        // Reload tasks to reflect new ID
        useTaskStore.getState().loadTasks();
      }
      TaskRepository.markSynced(serverId);
      SyncQueueRepository.removeByTaskId(task.id);
      SyncQueueRepository.removeByTaskId(serverId);
      useSyncStore.getState().refreshPendingCount();
    }
  } catch {
    // Will be retried by sync engine
  }
}

async function syncUpdateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<void> {
  try {
    const result = await TaskApi.updateTask(id, input);
    if (result.success) {
      TaskRepository.markSynced(id);
      SyncQueueRepository.removeByTaskId(id);
      useSyncStore.getState().refreshPendingCount();
    }
  } catch {
    // Will be retried
  }
}

async function syncDeleteTask(id: string): Promise<void> {
  try {
    const result = await TaskApi.deleteTask(id);
    if (result.success || result.status === 404) {
      TaskRepository.hardDelete(id);
      SyncQueueRepository.removeByTaskId(id);
      useSyncStore.getState().refreshPendingCount();
    }
  } catch {
    // Will be retried
  }
}
