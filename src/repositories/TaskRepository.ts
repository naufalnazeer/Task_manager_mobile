import { getDatabase, withTransaction } from '../database/connection';
import {
  Task,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
} from '../types/task';
import { generateId } from '../utils/id';

interface PaginatedResult {
  data: Task[];
  total: number;
}

/**
 * Repository layer for Task CRUD operations against local SQLite.
 * All operations are synchronous (react-native-quick-sqlite is sync).
 */
export const TaskRepository = {
  create(input: CreateTaskInput): Task {
    const db = getDatabase();
    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: 'pending',
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      lastSyncedAt: null,
      needsSync: true,
    };

    db.execute(
      `INSERT INTO tasks (id, title, description, priority, status, due_date, created_at, updated_at, version, is_deleted, last_synced_at, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.status,
        task.dueDate,
        task.createdAt,
        task.updatedAt,
        task.version,
        0,
        null,
        1,
      ],
    );

    return task;
  },

  update(id: string, input: UpdateTaskInput): Task | null {
    return withTransaction(db => {
      const existing = this.findById(id);
      if (!existing || existing.isDeleted) {
        return null;
      }

      const now = new Date().toISOString();
      const setClauses: string[] = ['updated_at = ?', 'version = version + 1', 'needs_sync = 1'];
      const setValues: (string | number | null)[] = [now];

      if (input.title !== undefined) {
        setClauses.push('title = ?');
        setValues.push(input.title);
      }
      if (input.description !== undefined) {
        setClauses.push('description = ?');
        setValues.push(input.description);
      }
      if (input.priority !== undefined) {
        setClauses.push('priority = ?');
        setValues.push(input.priority);
      }
      if (input.status !== undefined) {
        setClauses.push('status = ?');
        setValues.push(input.status);
      }
      if (input.dueDate !== undefined) {
        setClauses.push('due_date = ?');
        setValues.push(input.dueDate);
      }

      setValues.push(id);
      db.execute(
        `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`,
        setValues,
      );

      return this.findById(id);
    }) as Task | null;
  },

  softDelete(id: string): boolean {
    const db = getDatabase();
    const now = new Date().toISOString();
    const result = db.execute(
      `UPDATE tasks SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ? AND is_deleted = 0`,
      [now, id],
    );
    return (result.rowsAffected ?? 0) > 0;
  },

  hardDelete(id: string): boolean {
    const db = getDatabase();
    db.execute('DELETE FROM task_deltas WHERE task_id = ?', [id]);
    db.execute('DELETE FROM sync_queue WHERE task_id = ?', [id]);
    const result = db.execute('DELETE FROM tasks WHERE id = ?', [id]);
    return (result.rowsAffected ?? 0) > 0;
  },

  findById(id: string): Task | null {
    const db = getDatabase();
    const result = db.execute('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return this.mapRow(result.rows.item(0));
  },

  findAll(filters: TaskFilters = {}): PaginatedResult {
    const db = getDatabase();
    const conditions: string[] = ['is_deleted = 0'];
    const params: (string | number)[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }
    if (filters.searchQuery) {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      const q = `%${filters.searchQuery}%`;
      params.push(q, q);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = db.execute(
      `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
      params,
    );
    const total = countResult.rows?.item(0)?.total ?? 0;

    const dataResult = db.execute(
      `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC`,
      params,
    );

    const data: Task[] = [];
    if (dataResult.rows) {
      for (let i = 0; i < dataResult.rows.length; i++) {
        data.push(this.mapRow(dataResult.rows.item(i)));
      }
    }

    return { data, total };
  },

  /**
   * Upsert a task from server data (used during pull sync).
   */
  upsertFromServer(task: Task): void {
    const db = getDatabase();
    db.execute(
      `INSERT OR REPLACE INTO tasks (id, title, description, priority, status, due_date, created_at, updated_at, version, is_deleted, last_synced_at, needs_sync)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.status,
        task.dueDate,
        task.createdAt,
        task.updatedAt,
        task.version,
        task.isDeleted ? 1 : 0,
        new Date().toISOString(),
        0, // Server data doesn't need sync
      ],
    );
  },

  /**
   * Update local task ID to match server-assigned ID.
   */
  updateServerId(localId: string, serverId: string): void {
    const db = getDatabase();
    // Update sync queue references
    db.execute('UPDATE sync_queue SET task_id = ? WHERE task_id = ?', [
      serverId,
      localId,
    ]);
    // Update task ID
    db.execute('UPDATE tasks SET id = ? WHERE id = ?', [serverId, localId]);
  },

  /**
   * Mark a task as synced (no longer needs sync).
   */
  markSynced(id: string): void {
    const db = getDatabase();
    db.execute(
      'UPDATE tasks SET last_synced_at = ?, needs_sync = 0 WHERE id = ?',
      [new Date().toISOString(), id],
    );
  },

  /**
   * Search tasks with relevance ranking.
   * Title matches rank higher than description matches.
   * Returns results sorted by relevance then recency.
   */
  search(query: string, filters: TaskFilters = {}): Task[] {
    const db = getDatabase();
    const conditions: string[] = ['is_deleted = 0'];
    const params: (string | number)[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }

    const searchTerm = `%${query}%`;
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(searchTerm, searchTerm);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Rank: title match = 2, description-only match = 1, then by updated_at
    const sql = `
      SELECT *,
        CASE
          WHEN title LIKE ? THEN 2
          ELSE 1
        END as relevance
      FROM tasks
      ${whereClause}
      ORDER BY relevance DESC, updated_at DESC
    `;

    const result = db.execute(sql, [searchTerm, ...params]);
    const tasks: Task[] = [];
    if (result.rows) {
      for (let i = 0; i < result.rows.length; i++) {
        tasks.push(this.mapRow(result.rows.item(i)));
      }
    }
    return tasks;
  },

  mapRow(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) || '',
      priority: row.priority as Task['priority'],
      status: row.status as Task['status'],
      dueDate: (row.due_date as string) || null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      version: row.version as number,
      isDeleted: row.is_deleted === 1,
      lastSyncedAt: (row.last_synced_at as string) || null,
      needsSync: row.needs_sync === 1,
    };
  },
};
