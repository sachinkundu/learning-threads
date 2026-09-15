# Learning Threads

The private reader is https://learn.voxdez.com, protected by Cloudflare Access.
Chapter 1 (Preview) has 41 checked paragraphs, Figure 1.1, and the original PDF
pages on demand. Earlier joint examples and their source-linked discussions
remain in History. Later chapters still need checked imports.

Figures are cataloged once per book, with their original caption, source page,
and PDF crop. References such as “Figure 1.1(a)” resolve to that figure under
each paragraph that cites it, including Chapter 1 paragraphs 3 and 10. Repeated
references to its panels show the full figure once. Figure text stays outside
the source passage so saved highlight offsets remain unchanged. Questions carry
the figure's caption and source metadata in context; this does not send image
pixels to the assistant.

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

## Codex assistant

New questions use the private `learning-threads-codex` service binding. It runs
Codex CLI inside Cloudflare Sandbox with the owner's OAuth login. There is no
paid API fallback or Mac service. The runner owns the refresh cycle, encrypts
credentials in R2, and stores updated auth even when a later step fails. The
owner can reconnect with `scripts/seed-codex-auth.mjs` after a new Codex sign-in.

Settings still select Astra, Sol, Terra, or Luna and a reasoning level, with
Luna/High as the default. Each question freezes that choice. Reconnect uses the
same durable job ID; the runner never repeats an uncertain model submission.
A Durable Object runs queued work and collects it even when the browser closes.
The reader keeps the result in D1 alongside the existing assistant ledger.

`web/assistant-context.js` builds the full source/highlight/notes/ancestor and
current conversation packet. Prior visual source files and control values are
restored for follow-ups. Each job gets a fresh Codex session with this explicit
packet, so context does not depend on keeping a container alive. The app's
thread/message IDs and source anchors remain the durable learning graph.

The tutor can create self-contained HTML animations and inspect them with
Playwright. Files are saved in private R2 storage and shown inside the answer
in opaque sandboxed iframes. The app blocks external resources and navigation,
keeps the visual outside selectable answer text, and saves control state with
that answer. Follow-up edits create new versions while old visuals remain.

Usage shows token sums by model and overall. OAuth usage has subscription
billing and no API dollar estimate; the API-cost column retains historical API
charges. Cached input and reasoning output remain subsets, counted once. The
runner records elapsed container time separately. Generated-image API tools
are not configured. The historical direct-API handler only retrieves already
submitted answers at cutover; it cannot receive new reader questions.

### Historical API prices

Checked 2026-09-15: standard prices per million tokens:

| Model | Input | Cached input | Cache writes | Output |
| --- | ---: | ---: | ---: | ---: |
| Astra | $10 | $1 | $12.50 | $50 |
| Sol | $4 | $0.40 | $5 | $20 |
| Terra | $2 | $0.20 | $2.50 | $12 |
| Luna | $0.20 | $0.02 | $0.25 | $1.20 |

Above 272,000 input tokens, input/cache rates double and output rates increase
by 50%. Sol's listed promotional rates run at least through November 21, 2026;
recheck prices before updating the registry. Unknown models, mismatched price
snapshots, and unsupported service tiers remain unpriced. Sources:
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/background
- https://developers.openai.com/api/docs/guides/conversation-state

Interactive HTML visuals are implemented with SAC-219. Image generation and
precisely checked video links remain in SAC-197.

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

Migration 0004 adds the settings table and per-call configuration. It marks
existing OpenAI calls as Astra/Low, their known pre-settings configuration;
legacy CLI calls keep their original records. Apply it before deploying the
settings Worker. This migration is additive and compatible with the API Worker
that preceded settings. Astra supports Low through Maximum; the three 5.6
models also support None. The API does not accept the Codex-only Ultra level.

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

## Math and discussion links

The build copies pinned KaTeX assets from `node_modules` into `dist/vendor/katex`.
Assistant answers support `\( ... \)`, `\[ ... \]`, and `$$ ... $$`. Code samples
and invalid expressions stay as text. The renderer keeps the original delimited
source in `data-math-source`; highlight capture and decoration count that source
once, rather than the generated MathML and visual glyphs. Stored answer text and
existing highlight offsets are unchanged. Formula selections cover the whole
equation.

Discussion links use `?book=<book-id>&thread=<thread-id>&message=<message-id>`.
The message is optional. Existing IDs remain valid; new messages and branches use
random unique IDs. The reader waits for initial cloud sync before resolving an
incoming link, then focuses the requested question or answer. New questions set
the address bar immediately; receiving an answer keeps that question URL.
Links stay private behind the existing Cloudflare Access sign-in.

Markdown tables render as semantic headers and cells with horizontal overflow
for narrow screens. Hidden, non-accessible syntax markers preserve the original
pipes, delimiter row, and newlines in canonical text so saved highlight offsets
stay valid. Cell content supports inline formatting, code, escaped pipes, links,
and math. Malformed tables remain text without rewriting the saved answer.
