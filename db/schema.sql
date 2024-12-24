CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  message TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX reminders_by_user_id_and_ts ON reminders (user_id, ts);
