-- Local inbox for transaction captures submitted by the iOS Shortcut.
-- The API initializes a separate SQLite file from this schema at runtime.

CREATE TABLE IF NOT EXISTS captures (
  capture_id TEXT PRIMARY KEY,
  transaction_date TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income')),
  device_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS captures_status_created_at_idx
  ON captures (status, created_at);
