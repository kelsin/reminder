-- Migration number: 0001 	 2024-12-29T19:00:35.202Z

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX reminders_by_ts_and_user_id ON reminders (ts, user_id);
