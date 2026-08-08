CREATE TABLE IF NOT EXISTS sync_records (
  sync_id TEXT PRIMARY KEY,
  auth_hash TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
