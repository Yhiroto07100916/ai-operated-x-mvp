CREATE TABLE IF NOT EXISTS x_oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_x_oauth_states_expiry ON x_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS x_oauth_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  encrypted_tokens TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
