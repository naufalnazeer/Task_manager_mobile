import { TaskApi } from '../api/client';
import { TaskRepository } from '../repositories/TaskRepository';
import { SyncQueueRepository } from '../repositories/SyncQueueRepository';
import { SyncQueueItem, serverTaskToLocal } from '../types/task';
import { useTaskStore } from '../stores/taskStore';

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

/**
 * Sync engine that processes the offline queue and pulls server changes.
 * Implements push-then-pull strategy with exponential backoff retry.
 */
export const SyncEngine = {
  /**
   * Full sync cycle: push pending local changes, then pull from server.
   */
  async fullSync(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

    // Phase 1: Push local changes
    const pushResult = await this.pushChanges();
    result.pushed = pushResult.pushed;
    result.errors.push(...pushResult.errors);

    // Phase 2: Pull remote changes
    const pullResult = await this.pullChanges();
    result.pulled = pullResult.pulled;
    result.errors.push(...pullResult.errors);

    // Refresh task list if anything changed
    if (result.pushed > 0 || result.pulled > 0) {
      useTaskStore.getState().loadTasks();
    }

    return result;
  },

  /**
   * Process all pending items in the sync queue.
   */
  async pushChanges(): Promise<{ pushed: number; errors: string[] }> {
    const items = SyncQueueRepository.getPendingItems(20);
    let pushed = 0;
    const errors: string[] = [];

    for (const item of items) {
      SyncQueueRepository.markInProgress(item.id);

      try {
        const success = await this.processItem(item);
        if (success) {
          SyncQueueRepository.markCompleted(item.id);
          pushed++;
        } else {
          SyncQueueRepository.markFailed(item.id, 'Server rejected');
          errors.push(`Sync failed for task ${item.taskId}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        SyncQueueRepository.markFailed(item.id, msg);
        errors.push(`Sync error for task ${item.taskId}: ${msg}`);
      }
    }

    return { pushed, errors };
  },

  /**
   * Process a single queue item against the backend API.
   */
  async processItem(item: SyncQueueItem): Promise<boolean> {
    const payload = JSON.parse(item.payload);

    switch (item.operation) {
      case 'create': {
        const result = await TaskApi.createTask(payload);
        if (result.success && result.data) {
          const serverId = result.data._id;
          // Update local ID to match server
          if (serverId !== item.taskId) {
            TaskRepository.updateServerId(item.taskId, serverId);
          }
          TaskRepository.markSynced(serverId);
          return true;
        }
        return false;
      }

      case 'update': {
        const result = await TaskApi.updateTask(item.taskId, payload);
        if (result.success) {
          TaskRepository.markSynced(item.taskId);
          return true;
        }
        // 404 means task was deleted on server — remove locally
        if (result.status === 404) {
          TaskRepository.hardDelete(item.taskId);
          return true;
        }
        return false;
      }

      case 'delete': {
        const result = await TaskApi.deleteTask(item.taskId);
        if (result.success || result.status === 404) {
          TaskRepository.hardDelete(item.taskId);
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  },

  /**
   * Pull all tasks from server and reconcile with local DB.
   */
  async pullChanges(): Promise<{ pulled: number; errors: string[] }> {
    const errors: string[] = [];
    let pulled = 0;

    try {
      const result = await TaskApi.getAllTasks();
      if (!result.success || !result.data) {
        if (result.error) {
          errors.push(result.error);
        }
        return { pulled, errors };
      }

      const serverTasks = result.data;
      const serverIds = new Set(serverTasks.map(t => t._id));

      // Upsert server tasks locally
      for (const serverTask of serverTasks) {
        const localTask = serverTaskToLocal(serverTask);
        const existing = TaskRepository.findById(localTask.id);

        if (!existing) {
          TaskRepository.upsertFromServer(localTask);
          pulled++;
        } else if (!existing.needsSync) {
          // Server is source of truth if no local pending changes
          TaskRepository.upsertFromServer(localTask);
          pulled++;
        }
        // If existing.needsSync === true, keep local version
      }

      // Remove tasks that were deleted on server (but not locally pending)
      const localTasks = TaskRepository.findAll({}).data;
      for (const local of localTasks) {
        if (!serverIds.has(local.id) && !local.needsSync && local.lastSyncedAt) {
          TaskRepository.hardDelete(local.id);
          pulled++;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Pull failed';
      errors.push(msg);
    }

    return { pulled, errors };
  },
};
