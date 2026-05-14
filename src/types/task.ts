export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

/**
 * Task as returned by the backend (MongoDB document).
 */
export interface ServerTask {
  _id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  user: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Local task representation with offline-first metadata.
 */
export interface Task {
  id: string; // Maps to _id from server
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Offline-first metadata (local only)
  version: number;
  isDeleted: boolean;
  lastSyncedAt: string | null;
  needsSync: boolean;
}

export interface TaskDelta {
  id: string;
  taskId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
}

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'in_progress' | 'failed' | 'completed';

export interface SyncQueueItem {
  id: string;
  taskId: string;
  operation: SyncOperation;
  payload: string; // JSON serialized
  timestamp: string;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  errorMessage: string | null;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  searchQuery?: string;
}

/**
 * Convert server task to local task format.
 */
export function serverTaskToLocal(serverTask: ServerTask): Task {
  return {
    id: serverTask._id,
    title: serverTask.title,
    description: serverTask.description || '',
    status: serverTask.status,
    priority: serverTask.priority,
    dueDate: serverTask.dueDate,
    createdAt: serverTask.createdAt,
    updatedAt: serverTask.updatedAt,
    version: 1,
    isDeleted: false,
    lastSyncedAt: new Date().toISOString(),
    needsSync: false,
  };
}
