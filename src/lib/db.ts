import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import Database from "better-sqlite3";

declare global {
  var __taskManagerDb: Database.Database | undefined;
}

const databasePath = join(process.cwd(), "data", "task-manager.sqlite");

function initializeDatabase(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      project TEXT NOT NULL DEFAULT 'Personal',
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  `);
}

export function getDb() {
  if (!globalThis.__taskManagerDb) {
    mkdirSync(dirname(databasePath), { recursive: true });
    globalThis.__taskManagerDb = new Database(databasePath);
    initializeDatabase(globalThis.__taskManagerDb);
  }

  return globalThis.__taskManagerDb;
}
