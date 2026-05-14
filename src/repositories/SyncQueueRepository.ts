import { getDatabase } from '../database/connection';
import { SyncQueueItem, SyncOperation, SyncStatus } from '../types/task';
import { generateId } from '../utils/id';

/**
 * Repository for the sync queue stored in SQLite.
 * Manages FIFO ordering, retry scheduling with exponential backoff.
 */
export const SyncQueueRepository = {
  enqueue(
    taskId: string,
    operation: SyncOperation,
    payload: object,
  ): SyncQueueItem {
    const db = getDatabase();
    const item: SyncQueueItem = {
      id: generateId(),
      taskId,
      operation,
      payload: JSON.stringify(payload),
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
      nextRetryAt: null,
      errorMessage: null,
    };

    db.execute(
      `INSERT INTO sync_queue (id, task_id, operation, payload, timestamp, status, retry_count, max_retries, next_retry_at, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.taskId,
        item.operation,
        item.payload,
        item.timestamp,
        item.status,
        item.retryCount,
        item.maxRetries,
        item.nextRetryAt,
        item.errorMessage,
      ],
    );

    return item;
  },

  /**
   * Deduplicate: remove existing pending ops for same task+operation, then enqueue.
   */
  enqueueOrReplace(
    taskId: string,
    operation: SyncOperation,
    payload: object,
  ): SyncQueueItem {
    const db = getDatabase();

    // If deleting, remove all pending ops for this task
    try {
      if (operation === 'delete') {
        db.execute(
          `DELETE FROM sync_queue WHERE task_id = ? AND status IN ('pending', 'failed')`,
          [taskId],
        );
      } else {
        db.execute(
          `DELETE FROM sync_queue WHERE task_id = ? AND operation = ? AND status IN ('pending', 'failed')`,
          [taskId, operation],
        );
      }
    } catch (err) {
      console.log(err)
    }

    return this.enqueue(taskId, operation, payload);
  },

  /**
   * Get pending items ready for processing.
   */
  getPendingItems(limit = 20): SyncQueueItem[] {
    const db = getDatabase();
    const now = new Date().toISOString();
    const result = db.execute(
      `SELECT * FROM sync_queue
       WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
       ORDER BY timestamp ASC
       LIMIT ?`,
      [now, limit],
    );
    return this.mapRows(result);
  },

  getPendingCount(): number {
    const db = getDatabase();
    const result = db.execute(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`,
    );
    return result.rows?.item(0)?.count ?? 0;
  },

  markInProgress(id: string): void {
    const db = getDatabase();
    db.execute(`UPDATE sync_queue SET status = 'in_progress' WHERE id = ?`, [id]);
  },

  markCompleted(id: string): void {
    const db = getDatabase();
    db.execute('DELETE FROM sync_queue WHERE id = ?', [id]);
  },

  /**
   * Mark failed with exponential backoff (2^n seconds).
   */
  markFailed(id: string, errorMessage: string): void {
    const db = getDatabase();
    const result = db.execute(
      'SELECT retry_count, max_retries FROM sync_queue WHERE id = ?',
      [id],
    );
    if (!result.rows || result.rows.length === 0) {
      return;
    }

    const row = result.rows.item(0);
    const retryCount = (row.retry_count as number) + 1;
    const maxRetries = row.max_retries as number;

    if (retryCount >= maxRetries) {
      db.execute(
        `UPDATE sync_queue SET status = 'failed', retry_count = ?, error_message = ?, next_retry_at = NULL WHERE id = ?`,
        [retryCount, `MAX_RETRIES: ${errorMessage}`, id],
      );
      return;
    }

    // Exponential backoff
    const backoffMs = Math.pow(2, retryCount) * 1000;
    const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

    db.execute(
      `UPDATE sync_queue SET status = 'failed', retry_count = ?, next_retry_at = ?, error_message = ? WHERE id = ?`,
      [retryCount, nextRetryAt, errorMessage, id],
    );
  },

  /**
   * Remove all queue items for a given task.
   */
  removeByTaskId(taskId: string): void {
    const db = getDatabase();
    db.execute('DELETE FROM sync_queue WHERE task_id = ?', [taskId]);
  },

  clearAll(): void {
    const db = getDatabase();
    db.execute('DELETE FROM sync_queue');
  },

  mapRows(result: {
    rows?: { length: number; item: (i: number) => Record<string, unknown> };
  }): SyncQueueItem[] {
    const items: SyncQueueItem[] = [];
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        items.push({
          id: row.id as string,
          taskId: row.task_id as string,
          operation: row.operation as SyncOperation,
          payload: row.payload as string,
          timestamp: row.timestamp as string,
          status: row.status as SyncStatus,
          retryCount: row.retry_count as number,
          maxRetries: row.max_retries as number,
          nextRetryAt: (row.next_retry_at as string) || null,
          errorMessage: (row.error_message as string) || null,
        });
      }
    }
    return items;
  },
};
