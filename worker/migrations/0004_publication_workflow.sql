CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES ('publishing_mode', 'approval', CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS publication_jobs (
  candidate_id TEXT PRIMARY KEY REFERENCES candidates(id),
  state TEXT NOT NULL CHECK (state IN ('processing', 'published', 'failed', 'unknown')),
  x_post_id TEXT UNIQUE,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publication_jobs_state
  ON publication_jobs(state, updated_at DESC);
