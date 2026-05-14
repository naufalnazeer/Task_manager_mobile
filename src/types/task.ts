export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/**
 * Subtask within a parent task.
 */
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
  createdAt: string;
}

/**
 * File attachment metadata.
 */
export interface Attachment {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Voice note metadata.
 */
export interface VoiceNote {
  id: string;
  filePath: string;
  duration: number; // seconds
  createdAt: string;
}

/**
 * Recurrence configuration.
 */
export interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, etc.
  endDate?: string | null;
  occurrences?: number | null; // max number of occurrences
}

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
  category: string;
  labels: string[];
  notes: string;
  subtasks: Subtask[];
  recurrence: RecurrenceConfig;
  attachments: Attachment[];
  voiceNotes: VoiceNote[];
  user: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Local task representation with offline-first metadata.
 */
export interface Task {
  id: string;
  title: string;
  description: string; // Supports rich text (markdown)
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  category: string;
  labels: string[];
  notes: string;
  subtasks: Subtask[];
  recurrence: RecurrenceConfig;
  attachments: Attachment[];
  voiceNotes: VoiceNote[];
  createdAt: string;
  updatedAt: string;
  // Offline-first metadata
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
  payload: string;
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
  category?: string;
  labels?: string[];
  notes?: string;
  subtasks?: Subtask[];
  recurrence?: RecurrenceConfig;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  category?: string;
  labels?: string[];
  notes?: string;
  subtasks?: Subtask[];
  recurrence?: RecurrenceConfig;
  attachments?: Attachment[];
  voiceNotes?: VoiceNote[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  label?: string;
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
    category: serverTask.category || '',
    labels: serverTask.labels || [],
    notes: serverTask.notes || '',
    subtasks: serverTask.subtasks || [],
    recurrence: serverTask.recurrence || { type: 'none', interval: 1 },
    attachments: serverTask.attachments || [],
    voiceNotes: serverTask.voiceNotes || [],
    createdAt: serverTask.createdAt,
    updatedAt: serverTask.updatedAt,
    version: 1,
    isDeleted: false,
    lastSyncedAt: new Date().toISOString(),
    needsSync: false,
  };
}

/**
 * Default recurrence config.
 */
export const DEFAULT_RECURRENCE: RecurrenceConfig = {
  type: 'none',
  interval: 1,
};
