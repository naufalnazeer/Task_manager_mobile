/**
 * SQLite Database Schema for offline-first task manager.
 */

export const DB_NAME = 'task_manager.db';

export const CREATE_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in-progress', 'completed')),
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    needs_sync INTEGER NOT NULL DEFAULT 1
  );
`;

export const CREATE_SYNC_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
    payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'failed', 'completed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    next_retry_at TEXT,
    error_message TEXT
  );
`;

export const CREATE_TASK_DELTAS_TABLE = `
  CREATE TABLE IF NOT EXISTS task_deltas (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TEXT NOT NULL
  );
`;

export const CREATE_SYNC_META_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

export const CREATE_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted);',
  'CREATE INDEX IF NOT EXISTS idx_tasks_needs_sync ON tasks(needs_sync);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_task_id ON sync_queue(task_id);',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON sync_queue(next_retry_at);',
  'CREATE INDEX IF NOT EXISTS idx_task_deltas_task_id ON task_deltas(task_id);',
];
