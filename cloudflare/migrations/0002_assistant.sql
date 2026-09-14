CREATE TABLE IF NOT EXISTS assistant_calls (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  digest TEXT NOT NULL,
  status TEXT NOT NULL,
  created TEXT NOT NULL,
  result TEXT
);
CREATE INDEX IF NOT EXISTS assistant_calls_status ON assistant_calls(status,created);
CREATE TABLE IF NOT EXISTS assistant_bridge (id INTEGER PRIMARY KEY CHECK(id=1), seen TEXT NOT NULL);
