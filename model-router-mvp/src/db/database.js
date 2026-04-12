import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function createDatabase(rootDir) {
  const dataDir = path.join(rootDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'router.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_stats (
      model_id TEXT PRIMARY KEY,
      successes INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      retryable_failures INTEGER NOT NULL DEFAULT 0,
      retryable_failures_recent INTEGER NOT NULL DEFAULT 0,
      timeouts INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      total_latency_ms INTEGER NOT NULL DEFAULT 0,
      p95_latency_ms INTEGER NOT NULL DEFAULT 0,
      last_status TEXT,
      last_error_code TEXT,
      pricing_class TEXT,
      lifecycle_state TEXT NOT NULL DEFAULT 'active',
      disabled_reason TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      stack_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      error_code TEXT,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      is_mock INTEGER NOT NULL DEFAULT 0,
      was_fallback INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      request_summary_json TEXT,
      response_summary_json TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      summary_json TEXT NOT NULL
    );
  `);

  return db;
}
