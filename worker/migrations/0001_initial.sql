PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('post', 'repost')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')) DEFAULT 'pending',
  body TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  rationale TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewer_note TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_status_created
  ON candidates(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_type_created
  ON agent_memory(memory_type, created_at DESC);
