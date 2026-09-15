CREATE TABLE app_settings (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  configuration TEXT NOT NULL
);
ALTER TABLE assistant_calls ADD COLUMN configuration TEXT;
-- Prior OpenAI calls used the fixed Astra/low harness. Keep their setting on replay.
UPDATE assistant_calls SET configuration='{"model":"gpt-6-astra","reasoning":"low"}' WHERE provider='openai';
