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
 * Sync engine: push-then-pull with retry support.
 * This is the ONLY place that talks to the API for sync operations.
 * The task store enqueues operations; this engine processes them.
 */
export const SyncEngine = {
  async fullSync(): Promise<SyncResult> {
    const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

    const pushResult = await this.pushChanges();
    result.pushed = pushResult.pushed;
    result.errors.push(...pushResult.errors);

    const pullResult = await this.pullChanges();
    result.pulled = pullResult.pulled;
    result.errors.push(...pullResult.errors);

    if (result.pushed > 0 || result.pulled > 0) {
      useTaskStore.getState().loadTasks();
    }

    return result;
  },

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
        errors.push(`Sync error: ${msg}`);
      }
    }

    return { pushed, errors };
  },

  async processItem(item: SyncQueueItem): Promise<boolean> {
    const payload = JSON.parse(item.payload);

    switch (item.operation) {
      case 'create': {
        // Check if task still exists locally (might have been deleted)
        const localTask = TaskRepository.findById(item.taskId);
        if (!localTask) {
          // Task was deleted before sync — just remove from queue
          return true;
        }

        const result = await TaskApi.createTask(payload);
        if (result.success && result.data) {
          const serverId = result.data._id;

          // Update local task ID to match server
          if (serverId !== item.taskId) {
            TaskRepository.updateServerId(item.taskId, serverId);
            // Also clean up any other queue items referencing the old ID
            SyncQueueRepository.removeByTaskId(item.taskId);
          }

          TaskRepository.markSynced(serverId);
          return true;
        }

        // If 400 error (validation), don't retry
        if (result.error && result.status === 400) {
          console.warn('Task creation rejected by server:', result.error);
          return true; // Remove from queue, task stays local
        }

        return false;
      }

      case 'update': {
        // Check if task exists on server (has been synced before)
        const task = TaskRepository.findById(item.taskId);
        if (!task) {
          return true; // Task gone locally
        }

        // If task was never synced (still has local UUID), skip update — create will handle it
        if (!task.lastSyncedAt) {
          return true;
        }

        const result = await TaskApi.updateTask(item.taskId, payload);
        if (result.success) {
          TaskRepository.markSynced(item.taskId);
          return true;
        }
        if (result.status === 404) {
          // Task deleted on server — remove locally
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

      for (const serverTask of serverTasks) {
        const localTask = serverTaskToLocal(serverTask);
        const existing = TaskRepository.findById(localTask.id);
        if (!existing) {
          TaskRepository.upsertFromServer(localTask);
          pulled++;
        } else if (!existing.needsSync) {
          TaskRepository.upsertFromServer(localTask);
          pulled++;
        }
      }

      // Remove tasks deleted on server (only if they were previously synced and have no pending changes)
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
