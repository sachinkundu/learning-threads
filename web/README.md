# Learning Threads

The private reader is https://learn.voxdez.com, protected by Cloudflare Access.
Chapter 1 (Preview) has 41 checked paragraphs, Figure 1.1, and the original PDF
pages on demand. Earlier joint examples and their source-linked discussions
remain in History. Later chapters still need checked imports.

## Build and storage

`reading.html` is the editable page. Build from the repository root with
`rtk proxy python3 web/build.py`. The build embeds scripts and a checked book
catalog, generates CSP hashes, and copies only the approved source images into
`dist`. The historical visualization exporter is not used.

Browser storage keeps a local study copy. Cloudflare D1 stores immutable study
revisions and the current head. Concurrent edits preserve both copies for an
explicit choice. Highlights link to exact source ranges, questions, replies,
notes, and nested branches. Invalid or stale source anchors are never silently
reattached. Saved-copy restoration works; the exported-file round trip remains
tracked in SAC-193.

## OpenAI assistant

The live reader calls the OpenAI Responses API from a Cloudflare Worker.
Cutover status and real provider evidence are recorded in `planning/workpad.md`.
The API key is a Worker secret named `OPENAI_API_KEY`. It must never be added
to frontend assets, book data, study state, or version control.

`cloudflare/openai.ts` sets GPT-6 Astra, low reasoning effort, standard service,
and a 6,000-token output limit. `web/assistant-context.js` builds a complete
context snapshot: source paragraph and page references, exact highlight,
paragraph notes, ancestor conversations, current replies and notes, selected
reply ID, and visual state. Each request includes that packet explicitly. Old
CLI conversations therefore continue without an OpenAI conversation ID.
Context is not silently truncated. The teaching instructions treat source text
as data and prohibit automatic question suggestions and invented citations.

OpenAI starts a background response. D1 stores its provider ID. The browser can
poll for the result, and a Cloudflare cron collector saves it even after the
browser closes. Stored responses support recovery; D1 is the app's durable
record. There is no Mac polling loop, local inference process, or Codex login
requirement in this harness.

A D1 claim prevents duplicate submissions. Reconnect uses the original request
ID and retrieves an existing provider response. An uncertain submission is
never automatically reissued; its error and possible unreported charge remain
visible. Explicit Retry creates a separate attempt. Legacy CLI answers and
usage remain unchanged. Interrupted legacy jobs are not automatically billed
through the API.

Usage shows reported input, cached input, cache-write, output, and reasoning
tokens. Estimated API cost uses the price snapshot saved when the call starts.
Cache reads and writes are removed from ordinary input before pricing;
reasoning tokens are already included in output and are not charged twice.
Unknown usage and legacy charges remain unknown. Totals show the priced
subtotal and number of unpriced replies. Estimates do not include taxes or
account-specific billing adjustments.

Checked 2026-09-15: standard GPT-6 Astra prices per million tokens are $10 input,
$1 cached input, $12.50 cache writes, and $50 output. Above 272,000 input tokens,
input/cache rates double and output is $75. Sources:
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/background
- https://developers.openai.com/api/docs/guides/conversation-state

Generated images and new interactive answer visuals remain SAC-197. Text
diagrams and the previously approved prepared visuals are supported.

## Checks and release

Run `rtk proxy npm test`, `rtk proxy npm run test:server`, and
`rtk proxy npm run check`. Local tests cover context preservation, cost math,
concurrent claims, interrupted submissions, reconnects, and background result
collection, using SQLite and stubbed provider responses. They are not proof of
real OpenAI access. Live Brave checks for SAC-207 passed on 2026-09-15, including
a production follow-up with the Mac relay stopped and QA completion after the
browser tab closed. Provider records and deployment evidence are in the workpad.

The completed production cutover used this sequence:
1. Configure the Worker secret and verify a real API call in the isolated QA deployment.
2. Wait for the old relay's outstanding jobs to finish; preserve its local ledger.
3. Stop the old Mac LaunchAgent, then apply D1 migration 0003 and deploy.
4. In external Brave, continue an existing conversation with the Mac service
   stopped. Check source links, provider result, token counts, cost, and reload.
5. Read back the active Cloudflare version and its traffic allocation.

Migration 0003 adds fields without deleting old study or assistant rows. The
old Worker version expects the original assistant table shape, so do not
roll back code alone after this migration. Use a compatible forward fix.

## Optional local preview

`server/assistant.py` is now only a static reader and authenticated cloud API
proxy. It never executes Codex or generates an answer locally. For local review:

```sh
rtk proxy python3 server/assistant.py --site dist --cloud-config /path/to/private-preview-config.json --port 63403
```

The private preview config contains a workers.dev origin and its scoped bridge
token. Keep it outside the served folder. Production does not use this server.
The historical Tailscale script can start this optional preview, but the cloud
reader requires neither it nor Tailscale. The old local SQLite ledger is kept
for recovery; the new server does not open or modify it.

All browser review uses external Brave. Follow the UI removal test in AGENTS.md.
