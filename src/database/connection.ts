import { open, QuickSQLiteConnection } from 'react-native-quick-sqlite';
import {
  CREATE_TASKS_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_TASK_DELTAS_TABLE,
  CREATE_SYNC_META_TABLE,
  CREATE_INDEXES,
  DB_NAME,
} from './schema';

let db: QuickSQLiteConnection | null = null;

/**
 * Get or initialize the database connection (singleton).
 */
export function getDatabase(): QuickSQLiteConnection {
  if (!db) {
    db = open({ name: DB_NAME });
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(connection: QuickSQLiteConnection): void {
  connection.execute('PRAGMA journal_mode = WAL;');
  connection.execute('PRAGMA foreign_keys = ON;');
  connection.execute('PRAGMA synchronous = NORMAL;');

  connection.execute(CREATE_TASKS_TABLE);
  connection.execute(CREATE_SYNC_QUEUE_TABLE);
  connection.execute(CREATE_TASK_DELTAS_TABLE);
  connection.execute(CREATE_SYNC_META_TABLE);

  for (const index of CREATE_INDEXES) {
    connection.execute(index);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Execute within a transaction (synchronous).
 */
export function withTransaction<T>(
  fn: (connection: QuickSQLiteConnection) => T,
): T {
  const connection = getDatabase();
  connection.execute('BEGIN TRANSACTION;');
  try {
    const result = fn(connection);
    connection.execute('COMMIT;');
    return result;
  } catch (error) {
    connection.execute('ROLLBACK;');
    throw error;
  }
}
