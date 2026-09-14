# Learning Threads workpad

## Tailscale preview, 2026-09-14

User requested phone/iPad access while away from the computer.

- Live URL: https://sachins-macbook-pro.tailde98db.ts.net:8443/
- Added `scripts/deploy-tailscale.py` for repeatable builds and publication.
- A macOS user LaunchAgent runs the copied static artifact on loopback 63402.
  Tailscale Serve runs persistently on private HTTPS 8443.
- The existing HTTPS 443 route remains unchanged. Funnel is not enabled.
- Verified LaunchAgent state `running`, read back the Tailscale route, fetched
  HTTP 200 over the Tailscale HTTPS hostname with certificate verification,
  and compared its bytes against the built app: identical.
- This was verified from the hosting Mac; the user's phone/iPad has not been
  tested. The Mac must remain awake and connected. Cloud storage, cross-device
  state, and live assistant work are still queued.

Connection follow-up:

- User's sixsac device is online on the same tailnet. Both discovery and
  encrypted TSMP pings from the Mac received replies.
- Local app and Tailscale HTTPS both still returned HTTP 200. Incoming traffic
  is allowed by the Mac and the tailnet's compiled access rules.
- The user supplied `ERR_NAME_NOT_RESOLVED` for the Tailscale hostname. This
  identifies a DNS lookup failure on the client/browser path; a host-side
  HTTPS check alone did not prove phone access.
- Added a private TCP forward on port 8080. Direct address:
  http://100.117.88.81:8080/. Host-side HTTP 200 matched the built page exactly.
  The original HTTPS route and the unrelated route on 443 remain unchanged.
- The user opened the direct address on sixsac and confirmed: "that works".
  Use http://100.117.88.81:8080/ as the working preview address. Remote device
  access is now confirmed; the hostname's DNS issue remains separate.

## Delivery

[Learning Threads — Build](https://linear.app/sachinkundu/project/learning-threads-build-57bd4eda67f8)
has ten prioritized issues, SAC-191 through SAC-200, with prerequisite links.
See `build-backlog.md` for the build order. No OpenSpec.

## SAC-191: saved browser study

Implemented on `feat/sac-191-saved-study-state`.

- Keep the approved UI and source-highlight example.
- Save the active paragraph or thread, nested thread tree, messages, drafts,
  per-paragraph and per-answer notes, read marks, highlights, visual controls,
  scroll positions, and reading preferences after edits and before leaving.
- Store highlights as exact source text ranges, not saved HTML.
- Use versioned snapshots for this book and validate thread paths and source
  text before restoration. Do not overwrite corrupt or incompatible data.
- Keep the last good copy when a write fails. Show a recoverable error with an
  export containing the current work and the original stored snapshot.
- Build directly with `python3 web/build.py`. Remove the chat wrapper from the
  served document. Bundle local scripts and allow them using CSP hashes.

Validation, 2026-09-14:

- Six Node tests passed: reopen, quota failure, stale-tab protection, corrupt
  and future formats, damaged parent paths/edition mismatches, denied storage.
- All four generated inline scripts parsed successfully.
- In the real in-app browser, wrote a wrist-answer note, moved Joint 4 from
  35 to 36 degrees, opened Actuation and Torque, and typed a draft. Reload
  returned to Torque with the draft intact.
- Returned through both parent threads. The wrist note and 36-degree control
  remained. Back to highlight reached the exact original source sentence.
- Selected a new phrase by dragging, highlighted it, added a paragraph note,
  and marked the paragraph read. Reload preserved all of them.
- Closed the tab and opened a fresh tab at `/`. The same paragraph, highlight,
  note, read mark, and thread links returned. Its wrist highlight reopened the
  original question, note, and visual.
- An 820 by 1180 viewport fit without horizontal overflow. This is a responsive
  browser check, not physical iPad touch or cross-device verification.
- Browser console had no errors during these checks.

Limits:

- Storage is tied to this browser and origin. Clearing site data removes it.
- Stale-tab detection is not atomic concurrent editing; keep cloud conflict
  handling and import/restore in SAC-193.
- Answers remain prepared examples and the question action is still a copy
  handoff. SAC-194 and SAC-195 must ship together before the assistant release
  is complete. No token cost is claimed for this sample content.
- General selected-text thread anchors and revision history followed in SAC-192.
- Two paragraphs remain loaded. Full chapter/source checking is SAC-196.

User acceptance: after testing the working Tailscale address on sixsac, the user
confirmed "all this works and looks good." This accepts the SAC-191 reading and
saved-study flow. Continued with the next prioritized issue, SAC-192.

## SAC-192: exact highlights and revision history

Implemented on `feat/sac-192-source-linked-threads`.

- Book and answer selections store exact offsets, source identity, the selected
  quote, and surrounding text. Repeated phrases remain distinct. Each saved
  question carries its source link; a thread returns to that exact range.
- Book selections open a dedicated question thread. Ordinary answer follow-ups
  stay in the same thread. Explore separately keeps a parent link to the answer.
- Overlapping highlights retain every question. A chooser appears only where
  more than one discussion or an original joint/citation action shares the text.
  No nested buttons or links are introduced.
- Copy for Codex now saves the question before handing it off. Saved questions
  can be edited or copied again. Earlier wording remains in History. Paragraph
  and answer notes record earlier text when an edit ends; unfinished edits also
  survive a reload.
- Version 2 snapshots accept existing version 1 data without resetting it.
  Missing reply sources and changed source text fail visibly before any saved
  copy is overwritten.

Browser validation used a separate origin on port 63403, leaving the user's
saved study untouched:

- Selected a book phrase, saved a question, edited its wording, and reopened
  History after reload. The original question remained.
- Created a second overlapping selection. Its chooser opened the intended
  question. DOM inspection found no nested links or buttons.
- Edited a paragraph note and reloaded. Both the current note and its earlier
  version remained.
- Selected a phrase in the wrist answer, opened a separate thread, saved a
  question, returned to the exact answer highlight, and reopened the question.
  Reload preserved the source link and question. The copied context contained
  its exact answer source and ancestor conversations.
- Followed Wrist -> Actuation -> Torque. Back to highlight returned to each
  source word. The torque visual and edited answer note survived reload.
- Saved a selected-text follow-up inside Actuation. It stayed in that thread,
  and its source-return action focused the matching answer highlight.
- The highlighted spherical-joint term retained both its discussion and its
  original joint control. The browser reported no errors or storage failures.

Scope remains browser storage and the copy handoff. Live replies and usage are
SAC-194/SAC-195; private Cloudflare hosting and device sync are next in SAC-193.

Release verification, 2026-09-14:

- All 12 Node checks passed. All five generated inline scripts parsed and
  matched their CSP hashes. `git diff --check` passed.
- Published the built artifact with `scripts/deploy-tailscale.py`. The working
  address http://100.117.88.81:8080/ returned HTTP 200 and bytes identical to
  the build (SHA-256 `aad789b13fd799a433ecfd62144d3db9a66fd9eefd794eb98541d5d5b3499f11`).
- Opened the deployed direct address in the in-app browser and confirmed the
  reading page rendered. This update has host-side browser verification; the
  user's acceptance above applies to the previous build.
- Read back Tailscale configuration: the 8080 forward and both existing HTTPS
  routes on 443 and 8443 remain intact.

## SAC-194 / SAC-195: live Codex replies and usage

The user asked to wrap the button in the Codex CLI so the learning flow could
be tested. Brought SAC-194 ahead of Cloudflare sync and removed SAC-193 as its
prerequisite. This is a host-backed private preview; SAC-193 remains open.
No OpenSpec.

Implemented on `feat/sac-194-codex-replies`:

- Replaced Copy for Codex with Ask Codex. Replies use the current passage,
  exact selected source, ancestor conversations, and earlier replies. Ordinary
  follow-ups stay in their thread. Live answer text supports highlighting,
  child threads, notes, and safe Markdown/text-diagram rendering.
- Use `codex exec --json` with existing ChatGPT authentication. The standalone
  CLI 0.150.1 failed with the provider error that gpt-6-astra needs a newer CLI.
  The app-bundled executable at
  `/Applications/ChatGPT.app/Contents/Resources/codex` is 0.153.4 and passed.
  It uses gpt-6-astra at low reasoning effort. No user config or credentials
  were changed. No API key was introduced.
- Run in an empty temporary workspace with read-only sandboxing. Disable
  shell, apps, plugins, browser, image generation, and delegation features.
  The request is passed over stdin as data, never interpolated into a shell.
- The private Python server keeps request IDs, replies, errors, and usage in
  SQLite outside the served directory. One model call runs at a time; up to
  four may be queued/running. Reusing a request ID does not launch a new call.
- Reload and tab closure recover pending replies. Failed calls can be retried
  on the same question, with each new attempt retained in the ledger. Network
  reconnects keep the original ID. Server restarts mark interrupted work as
  failed rather than silently rerunning it.
- Usage shows provider-reported input, cached input, output, and reasoning
  tokens per call and in total. Dollar charges are not reported by this CLI
  login and remain unknown in the UI. No API-price estimate or zero cost is
  presented. The ledger retains failed attempts with unknown usage.
- API calls require the app header and allowed host/origin. The server binds
  only to loopback and serves only the built page and its API. Tailscale
  access remains on 8080/8443; the unrelated 443 route remains unchanged.

Verification, 2026-09-14:

- 15 Node tests and four Python tests passed. Checks cover source persistence,
  safe rendering, unknown usage, call idempotency, separate retry accounting,
  interrupted work, origin rejection, and keeping private files unserved.
  All six inline scripts parsed and matched CSP hashes.
- In the real browser on the isolated QA origin, submitted a wrist follow-up
  and reloaded while it ran. It returned one live answer with a text diagram,
  with exactly one server call: 11,578 input / 6,912 cached / 249 output tokens.
- Selected a phrase inside that answer and opened a child discussion. Closed
  the tab during its request, reopened it, and received the answer. Back to
  highlight focused the exact parent phrase. Usage: 12,070 input / 0 cached /
  135 output tokens. These two calls had no browser or storage errors.
- Induced a missing-executable failure in the QA server. The original error
  and Retry appeared beside the saved question. Restored the executable and
  retried through the UI: one question, one new answer, with the failed and
  successful attempts separately retained. The QA ledger had four attempts:
  three completed, one failed. The successful retry reported 11,906 input /
  6,912 cached / 37 output tokens.
- Upgraded the persistent LaunchAgent from a static server to the bridge.
  The first upgrade hit a launchd unload timing race; fixed bootstrap handling
  and redeployed successfully. Future deploys refuse to interrupt active work.
- On the deployed address http://100.117.88.81:8080/, used the actual Ask Codex
  button for a helical-joint question. The LaunchAgent called Codex, the answer
  appeared in the page, and Usage recorded 10,996 input / 6,912 cached / 94
  output tokens. Browser console was clean. This is a browser-to-deployed-
  server-to-provider check from the host, not a claim of physical iPad testing.
- The deployed page returned HTTP 200 and matched the build, SHA-256
  `b9900d39d5fb407e094660dfe48e681e63a3501aaa94fc7bb3dcd460bd5c564c`.

Remaining: private Cloudflare hosting and device sync (SAC-193), full chapter
content (SAC-196), generated images and interactive live visuals (SAC-197), and
physical iPad polish (SAC-198). The Mac must remain awake and on Tailscale.
Book study still resides in browser storage; the server reply ledger does not
sync the full study state across devices.

CLI documentation used: https://learn.chatgpt.com/docs/non-interactive-mode
