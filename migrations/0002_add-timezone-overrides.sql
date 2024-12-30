-- Migration number: 0002 	 2024-12-30T04:22:25.616Z

CREATE TABLE IF NOT EXISTS timezones (
  discord_id TEXT PRIMARY KEY,
  timezone TEXT NOT NULL
);
