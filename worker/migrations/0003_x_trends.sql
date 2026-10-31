CREATE TABLE IF NOT EXISTS x_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trend_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  tweet_count INTEGER,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_x_trends_fetched
  ON x_trends(fetched_at DESC, rank ASC);
