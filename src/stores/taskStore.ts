import { create } from 'zustand';
import {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  serverTaskToLocal,
  Attachment,
  VoiceNote,
  Subtask,
} from '../types/task';
import { TaskRepository } from '../repositories/TaskRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { TaskApi } from '../api/client';
import { useNetworkStore } from './networkStore';
import { useSyncStore } from './syncStore';
import { generateId } from '../utils/id';

interface TaskState {
  tasks: Task[];
  searchResults: Task[];
  categories: string[];
  allLabels: string[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  filters: TaskFilters;

  // Task CRUD
  loadTasks: () => void;
  createTask: (input: CreateTaskInput) => Task;
  updateTask: (id: string, input: UpdateTaskInput) => Task | null;
  deleteTask: (id: string) => boolean;
  getTask: (id: string) => Task | null;

  // Search & Filters
  searchTasks: (query: string) => void;
  clearSearch: () => void;
  setFilters: (filters: TaskFilters) => void;

  // Subtasks
  addSubtask: (taskId: string, title: string) => Task | null;
  toggleSubtask: (taskId: string, subtaskId: string) => Task | null;
  removeSubtask: (taskId: string, subtaskId: string) => Task | null;

  // Attachments & Voice Notes
  addAttachment: (taskId: string, attachment: Attachment) => Task | null;
  removeAttachment: (taskId: string, attachmentId: string) => Task | null;
  addVoiceNote: (taskId: string, voiceNote: VoiceNote) => Task | null;
  removeVoiceNote: (taskId: string, voiceNoteId: string) => Task | null;

  // Metadata
  loadCategories: () => void;
  loadAllLabels: () => void;

  // Sync
  pullFromServer: () => Promise<void>;
  clearError: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  searchResults: [],
  categories: [],
  allLabels: [],
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
    } catch {
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], isSearching: false });
  },

  createTask: (input: CreateTaskInput): Task => {
    const task = TaskRepository.create(input);

    // Enqueue for sync — the background sync engine will handle it.
    // Do NOT fire-and-forget here to avoid race conditions with the sync engine.
    SyncQueueRepository.enqueueOrReplace(task.id, 'create', {
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      category: task.category,
      labels: task.labels,
      notes: task.notes,
      subtasks: task.subtasks,
      recurrence: task.recurrence,
    });
    useSyncStore.getState().refreshPendingCount();

    // Trigger sync (non-blocking) — the sync engine handles deduplication
    const isConnected = useNetworkStore.getState().isConnected;
    if (isConnected) {
      useSyncStore.getState().triggerSync();
    }

    set(state => ({ tasks: [task, ...state.tasks] }));
    get().loadCategories();
    get().loadAllLabels();
    return task;
  },

  updateTask: (id: string, input: UpdateTaskInput): Task | null => {
    const updated = TaskRepository.update(id, input);
    if (!updated) {
      return null;
    }

    // Build a sync-safe payload (exclude local file URIs for attachments/voiceNotes)
    const syncPayload: Record<string, unknown> = {};
    if (input.title !== undefined) syncPayload.title = input.title;
    if (input.description !== undefined) syncPayload.description = input.description;
    if (input.priority !== undefined) syncPayload.priority = input.priority;
    if (input.status !== undefined) syncPayload.status = input.status;
    if (input.dueDate !== undefined) syncPayload.dueDate = input.dueDate;
    if (input.category !== undefined) syncPayload.category = input.category;
    if (input.labels !== undefined) syncPayload.labels = input.labels;
    if (input.notes !== undefined) syncPayload.notes = input.notes;
    if (input.subtasks !== undefined) syncPayload.subtasks = input.subtasks;
    if (input.recurrence !== undefined) syncPayload.recurrence = input.recurrence;
    // Attachments and voiceNotes are synced via separate upload endpoints, not PUT

    // Only enqueue if there are server-syncable fields
    if (Object.keys(syncPayload).length > 0) {
      SyncQueueRepository.enqueueOrReplace(id, 'update', syncPayload);
      useSyncStore.getState().refreshPendingCount();

      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        useSyncStore.getState().triggerSync();
      }
    }

    set(state => ({
      tasks: state.tasks.map(t => (t.id === id ? updated : t)),
    }));
    get().loadCategories();
    get().loadAllLabels();
    return updated;
  },

  deleteTask: (id: string): boolean => {
    const success = TaskRepository.softDelete(id);
    if (!success) {
      return false;
    }

    SyncQueueRepository.enqueueOrReplace(id, 'delete', { id });
    useSyncStore.getState().refreshPendingCount();

    const isConnected = useNetworkStore.getState().isConnected;
    if (isConnected) {
      useSyncStore.getState().triggerSync();
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

  // ─── Subtasks ──────────────────────────────────────────────────────────────

  addSubtask: (taskId: string, title: string): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const newSubtask: Subtask = {
      id: generateId(),
      title,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    const subtasks = [...task.subtasks, newSubtask];
    return get().updateTask(taskId, { subtasks });
  },

  toggleSubtask: (taskId: string, subtaskId: string): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const subtasks = task.subtasks.map(s =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s,
    );
    return get().updateTask(taskId, { subtasks });
  },

  removeSubtask: (taskId: string, subtaskId: string): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const subtasks = task.subtasks.filter(s => s.id !== subtaskId);
    return get().updateTask(taskId, { subtasks });
  },

  // ─── Attachments ───────────────────────────────────────────────────────────
  // Attachments are stored locally immediately.
  // Upload to server happens separately (not via the sync queue PUT).

  addAttachment: (taskId: string, attachment: Attachment): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const attachments = [...task.attachments, attachment];
    // Update locally only (attachments array in SQLite)
    const updated = TaskRepository.update(taskId, { attachments });
    if (updated) {
      set(state => ({
        tasks: state.tasks.map(t => (t.id === taskId ? updated : t)),
      }));

      // If online, upload the file to server
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        TaskApi.uploadAttachment(
          taskId,
          attachment.filePath,
          attachment.fileName,
          attachment.mimeType,
        ).catch(() => {
          // Upload failed — will need manual retry
        });
      }
    }
    return updated;
  },

  removeAttachment: (taskId: string, attachmentId: string): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const attachments = task.attachments.filter(a => a.id !== attachmentId);
    return get().updateTask(taskId, { subtasks: task.subtasks }); // trigger sync for metadata
  },

  // ─── Voice Notes ───────────────────────────────────────────────────────────

  addVoiceNote: (taskId: string, voiceNote: VoiceNote): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const voiceNotes = [...task.voiceNotes, voiceNote];
    const updated = TaskRepository.update(taskId, { voiceNotes });
    if (updated) {
      set(state => ({
        tasks: state.tasks.map(t => (t.id === taskId ? updated : t)),
      }));

      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        TaskApi.uploadVoiceNote(taskId, voiceNote.filePath, voiceNote.duration).catch(() => {});
      }
    }
    return updated;
  },

  removeVoiceNote: (taskId: string, voiceNoteId: string): Task | null => {
    const task = TaskRepository.findById(taskId);
    if (!task) return null;
    const voiceNotes = task.voiceNotes.filter(v => v.id !== voiceNoteId);
    const updated = TaskRepository.update(taskId, { voiceNotes });
    if (updated) {
      set(state => ({
        tasks: state.tasks.map(t => (t.id === taskId ? updated : t)),
      }));
    }
    return updated;
  },

  // ─── Metadata ──────────────────────────────────────────────────────────────

  loadCategories: () => {
    const categories = TaskRepository.getCategories();
    set({ categories });
  },

  loadAllLabels: () => {
    const allLabels = TaskRepository.getAllLabels();
    set({ allLabels });
  },

  // ─── Sync ──────────────────────────────────────────────────────────────────

  pullFromServer: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await TaskApi.getAllTasks();
      if (result.success && result.data) {
        for (const serverTask of result.data) {
          const localTask = serverTaskToLocal(serverTask);
          const existing = TaskRepository.findById(localTask.id);
          if (!existing) {
            TaskRepository.upsertFromServer(localTask);
          } else if (!existing.needsSync) {
            TaskRepository.upsertFromServer(localTask);
          }
        }
        get().loadTasks();
        get().loadCategories();
        get().loadAllLabels();
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
