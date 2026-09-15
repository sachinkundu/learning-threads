-- Keep the CLI ledger and original study snapshots intact.
ALTER TABLE assistant_calls ADD COLUMN provider TEXT NOT NULL DEFAULT 'codex';
ALTER TABLE assistant_calls ADD COLUMN provider_id TEXT;
ALTER TABLE assistant_calls ADD COLUMN submission_started TEXT;
ALTER TABLE assistant_calls ADD COLUMN poll_after INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assistant_calls ADD COLUMN poll_lease_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assistant_calls ADD COLUMN pricing TEXT;
CREATE INDEX assistant_calls_provider ON assistant_calls(provider,status,poll_after);
