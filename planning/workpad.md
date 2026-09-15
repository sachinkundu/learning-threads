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

## SAC-203: original source page on demand

The learner asked to check the original PDF page while reading a paragraph.
Added Source p. 16 to the shared book bar, available in paragraphs and threads.
It opens a reference panel beside the web content (below it on narrow screens),
with Zoom in / Fit page and Close. It replaces the joint visual only while open.
It starts closed on every reload; drafts, notes, replies, and highlight links
remain in their existing saved state. No new explanatory UI copy.

Source: MR-v2.pdf printed page 16 is PDF page 36 (index 35). Reused the exact
1275 x 1651 render verified against the source, retaining page margins, figure,
type, and footer. Both current paragraphs occur on this page. The server serves
only the explicit checked image route, not a PDF or a directory listing.

Verification, 2026-09-14:
- Deployed through the existing LaunchAgent on http://100.117.88.81:8080/.
- Browser: hidden by default; open/zoom/close; draft survives reload; source
  opens in the wrist thread; Back to highlight returns to the exact text.
- Responsive check at 390 x 844: no document overflow; the page panel sits
  between the excerpt and conversation. Desktop shows both columns. This is
  viewport testing, not a physical iPad test. Browser console had no errors.
- All 15 Node and 4 Python tests passed. Extended the existing HTTP guard test
  to check the image route and deny directory traversal, PDF, and private data.
- Served PNG bytes match the verified render; SHA-256
  4b76644aa3e49f984315693200caa8d306b3d0f3da6832b255aace729a52cae0.
- Linear description readability passed: ease 83.27, grade 4.63.

SAC-193 remains in progress. Dependencies installed for Cloudflare Workers;
account, zone, and owner identity verified. No cloud sync or public deployment
has been claimed or released at this point.

## SAC-193: Cloudflare sync and Mac assistant relay

Current branch: feat/sac-193-cloud-sync. Source-page work was committed as
337e6a7 before this slice. No OpenSpec. The user now requires external Brave
for every browser action; this is recorded in AGENTS.md.

Implemented:
- Worker serves only authenticated static assets. run_worker_first protects
  the reader and checked PDF renders. Browser routes require a verified Access
  JWT with the configured issuer, audience, and owner email. Missing settings
  fail closed. Internal machine routes require a separate random secret.
- D1 keeps immutable study snapshots and a current revision pointer. Each
  submitted copy is retained transactionally before comparing the expected
  revision. Stale edits return a conflict, with both copies recoverable.
- The browser keeps an outbox and reuses the same revision ID after lost
  acknowledgements. Unsynced edits survive reopening. Viewport scroll offsets
  alone do not conflict with changed learning content.
- Reading view now includes Export, Restore, and Saved copies. Restore keeps
  current work before changing the head. Notes, drafts, replies, source offsets,
  and nested parent links are validated before a saved copy is applied.
- The existing Tailscale server forwards study requests to the Worker. This
  allows old origins to migrate their saved work without copying browser data
  through chat. The first returning device seeds the current study. Different
  existing device copies cause a choice, never a silent overwrite.
- The Mac polls Cloudflare for assistant work and publishes its existing reply
  ledger. Cloud and local calls use the same SQLite Jobs IDs, so repeated
  delivery does not run Codex again. Codex credentials stay on the Mac.
- A cloud request is rejected while the Mac heartbeat is offline. Reconnect
  keeps the request ID when the outcome is uncertain. Known validation/size/
  queue rejections allow editing and a fresh retry. Costs remain unreported.

Resources (all new and specific to Learning Threads):
- Production Worker: learning-threads, https://learning-threads.skundu.workers.dev
- Production D1: learning-threads-study, 9a8bbbe7-c588-41c8-a67c-e942f79d22b1, EU
- QA Worker: learning-threads-sync-qa (locked, used only by the QA bridge)
- QA D1: learning-threads-sync-qa, 5fea1ad4-069e-4631-a902-bfc303e05f50, EU
- Migrations 0001_study.sql and 0002_assistant.sql applied remotely to both.
- Production bridge secret is in the Worker secret store and the 0600 file
  /Users/sachin/Library/Application Support/LearningThreads/cloud-sync.json.
  It is never served or embedded in the reader.
- QA configuration: /tmp/learning-threads-sync-qa.json; private machine config:
  /tmp/learning-threads-sync-qa-secret.json. Do not print its token.

Verification, 2026-09-14:
- 22 Node tests and 6 Python tests pass, including interrupted acknowledgements,
  independent device conflicts, in-flight edits, restore preservation, source
  integrity, safe assistant rendering, and repeated cloud job delivery.
- TypeScript checks pass. Seven inline scripts parse and match CSP hashes.
- Real browser sessions on separate localhost origins used the QA Cloudflare
  Worker and D1. The second session restored the full existing study, including
  nested live-answer threads, revisions, and exact source highlights.
- Competing computer/tablet drafts caused an explicit choice. Saved copies
  showed the rejected computer draft. Restoring it changed the cloud head;
  closing and reopening the second session restored that same draft.
- During a deliberate QA bridge disconnection, the edited draft survived a
  browser reload and the app showed an actionable connection error. The
  browser was closed during the later switch to Brave; a new browser recovery
  check is still required before claiming the full outage/reconnect flow.
- tests/probe-cloud-sync.py ran against real QA D1: simultaneous writes yielded
  one accepted head and one preserved conflict (versions 10 and 11). Repeating
  the accepted ID returned the same version. Changing its body was rejected.
  Anonymous readers/source images/APIs and machine access to the reader were
  denied. A synthetic terminal ledger record tested idempotent publication;
  this was a protocol fixture, not a provider call. Fixture ID:
  qa-ledger-3886de4f-848c-4783-94d4-b480423d8100.
- Source render and sync were deployed to the existing Tailscale LaunchAgent.
  http://100.117.88.81:8080/ returns the exact build (SHA-256
  0ada946175df52416bc1414f4921aa33535b976f61b937276f3906e06438b72e).
  Its study API returns HTTP 200 from the real production Worker with no head
  yet, ready for the user's first returning browser. The local usage ledger
  has 3 calls: 33,612 input / 20,736 cached / 417 output tokens.
- Current production Worker version: bc1eccfc-3f42-46b5-8f67-f4c0f14a79f2.
  Access issuer/audience are deliberately blank until setup is completed.

Private-hosting setup still open:
- Wrangler OAuth can deploy Workers/D1 but cannot create Access applications
  (HTTP 403 auth.forbidden). Its Access list returned an empty, permission-
  filtered result; do not treat that as an account-wide inventory.
- The signed-in Brave dashboard shows the existing team domain
  deos-voxdez.cloudflareaccess.com and five existing applications.
- Started a separate Learning Threads application for learn.voxdez.com with an
  email-only rule for the verified account email sachin.kundu@pm.me. This is
  not yet saved. Browser automation paused at the email/policy step because
  another extension popup is open. The user has been asked to close it.
- After the popup closes: finish the scoped rule, read its audience ID, set
  issuer/audience in wrangler.jsonc, check the hostname and add the custom
  domain, then verify owner sign-in and a real live Codex question through
  the cloud reader. Finish the Brave outage/reconnect and file-restore checks.
- Do not mark SAC-193 Done yet. The locked workers.dev endpoint is not the
  learner's cloud reading URL. The current working link remains Tailscale.

Primary references: Cloudflare Worker asset routing (run_worker_first), D1
transactional batch API, and the current official Cloudflare TypeScript SDK
application/organization schemas. Cloudflare API requests from Python need
User-Agent: LearningThreadsSync/1.0; the default urllib agent received edge
error 1010, while the explicit app agent reached the Worker correctly.

### Cloud release and remaining file verification

The Brave popup cleared and private hosting is now deployed at
https://learn.voxdez.com. Access application ff3b564b-df92-4f56-a52f-998277fca6bf
uses the Learning Threads owner policy 7e62a840-218a-4ff1-975c-9a3e6b24eff3.
Its sole allow rule is the email sachin.kundu@pm.me. The signed-in Cloudflare
account provider successfully opened the reader in external Brave. Existing
Access applications and policies were preserved. Issuer and audience are now
configured in wrangler.jsonc.

Wrangler's custom-domain changeset reported one addition and no updates,
removals, or conflicting DNS records before learn.voxdez.com was attached.
Production Worker version: 1eab9fb5-37d8-40fb-8092-1a2f6df9186b.

Live verification:
- Anonymous requests to the custom-domain reader and exact PDF image redirect
  to Access sign-in. Anonymous workers.dev reader/API/internal requests return
  401. A valid machine credential also cannot open the public reader.
- The signed-in cloud reader submitted a question about helical joints.
  Cloudflare queued it, the Mac ran Codex, and the answer appeared in the
  browser. Local job amu1h7k61-rwaz9zy3ho completed at
  2026-09-14T16:47:35.419738+00:00. Usage displayed 10,991 input, 6,912 cached
  input, 66 output, 0 reasoning tokens, model gpt-6-astra. The provider did
  not report a dollar charge; no zero or estimated charge was substituted.
- A fresh Brave session on the separate 127.0.0.1:63402 origin restored that
  same question and answer from production D1. Production study version 4
  contained the live answer. This proves independent browser storage, not a
  physical iPad trial.
- The original PDF panel opened through the authenticated cloud reader and
  showed printed page 16 / PDF page 36, then closed normally.
- During a deliberate QA bridge outage, a new draft survived reload in Brave.
  Restoring the bridge automatically cleared the error and saved that draft
  to real QA D1 version 20 without another click.
- Found and fixed an ID-reuse edge case: a changed request using a previously
  rejected revision ID must not move the head before returning its conflict.
  The transactional update now matches the stored book, base, and state.
  The real QA D1 probe covers both changed accepted and rejected IDs. It
  passed with concurrent versions 14/15, one current and one preserved.
- Final checks: 22 Node tests, 6 Python tests, and TypeScript all pass.

File backup verification remains open. The native Export link generates a
blob file from the current study. Browser automation did not observe its
download, and no matching file appeared in the checked Downloads directory.
The user has been asked whether Brave displayed a download. A QA file-restore
attempt reached the file chooser, but the browser extension rejected setting
the file with "Not allowed". No extension permissions were changed and no
alternate browser was used. Saved-copy restoration through the app was
already proven; this is specifically the exported-file round trip. SAC-193
remains In Progress until that check is finished. QA infrastructure is retained
for that final check. The production reader and Tailscale bridge are available.

Migration note: an existing Tailscale browser can submit its older saved study
to cloud sync. If it differs from the cloud copy, the learner chooses which
copy becomes current, and both remain in Saved copies. Do not import the QA
fixture into the production study. The Mac must be awake for live Codex calls;
Cloudflare serves reading and study sync independently.


## SAC-196 — Chapter 1 reading release, 2026-09-15

The reader now starts at Chapter 1, Preview. Its 41 paragraphs were checked
against printed pages 1–10 (PDF pages 21–30) of MR-v2.pdf. The catalog retains
the source PDF SHA-256 and stable paragraph IDs. Paragraphs split by a page
break remain one paragraph, with both source pages available. Figure 1.1 is a
separate web image with selectable caption text. Inline mathematics was
checked visually and repaired where extraction lost accents or symbols.
`scripts/extract-chapter-one.py` creates a review draft; the checked catalog in
`web/books/modern-robotics.json` is the published source.

The ordered path contains Chapter 1 only. Later chapters still need checked
imports. The two previous section 2.2.1 passages retain slots 0 and 1, exact
text offsets, conversation IDs, notes, highlights, and nested source links.
History exposes earlier work without putting the sample into Chapter 1's
sequence. Migration moves the starting place once, then normal resume applies.
No mastery gate was introduced.

Persistence accepts both old two-paragraph snapshots and the new catalog
revision. Cloud comparisons normalize old copies before detecting conflicts;
an unacknowledged write retains its original request ID and body. Migration
never mutates the saved input. Unknown book revisions and invalid source
positions are rejected. Usage and Saved copies dialogs now use the defined,
opaque surface color instead of the undefined panel variable.

Verification:
- 26 Node tests, 6 Python tests, and TypeScript pass. New tests cover preservation
  of nested work, repeat migration, invalid catalog references, all 41 ordered
  paragraphs, cloud migration against newer tablet edits, and lost acknowledgements.
- External Brave on the separate QA origin restored the existing rich D1 copy,
  opened Chapter 1, and followed the old spherical highlight into its original
  wrist thread. Nested source links and the offline draft were retained.
- Brave traversed paragraphs 1–41, finished the chapter, and reloaded at
  paragraph 41 with the completion mark retained. No jump to the old sample.
- Printed pages 1 and 2 were selectable for the cross-page fourth paragraph.
  The hidden source view loaded the checked images. Figure 1.1 and the source
  panel were checked at an 820 × 1180 tablet viewport; no horizontal overflow.
- Usage was visually opaque in Brave. This is browser tablet-size testing,
  not a physical iPad trial.
- Cloudflare release a4d414ea-6e1d-4c8a-b4d4-8c6614d663da is at 100% traffic.
  The Mac/Tailscale service was updated with all new checked source assets.
  The signed-in production page opened at Chapter 1. D1 version 8 read back
  readingVersion 1 and 43 preserved paragraph slots.

Assistant architecture clarification: the Mac LaunchAgent makes outbound
HTTPS requests every three seconds to pick up questions stored in Cloudflare
D1. It invokes codex exec with the existing Codex login, then uploads replies
and token usage. OpenAI performs inference. Cloudflare does not initiate an
inbound connection to the Mac. Cloud reading and sync work without the Mac;
assistant responses require the Mac awake and online. Tailscale is not involved
in this cloud relay. This follows the earlier request to wrap the Codex CLI.

SAC-193 remains open for the exported-file backup/restore check described above.

Live follow-up proof: production Chapter 1 question amu28t3wi-mf2sqnmw2ym
completed with 10,840 input / 6,784 cached input / 52 output tokens. Follow-up
amu28tp1z-1sn9nxyvn2d contained chapter 1, paragraph mr-ch01-p001, replyTo m4,
and both prior messages; it completed with 10,957 input / 0 cached input /
112 output tokens. Both used gpt-6-astra. The browser displayed a cup-reaching
example and text diagram. Production D1 version 11 contained all four messages
and both completed requests. Reload retained both exchanges. Dollar charges
were not reported. The live Usage dialog computed rgb(32,41,43), opacity 1.
The authenticated page-1 source image loaded at 1020px width, and an anonymous
request to the same new image redirected to Access sign-in.

Final release c03c3f61-51a9-476f-832a-6c687729fd33 also fixes the saved-copy
preview label to use the book paragraph number rather than its storage slot.
Brave opened the saved copy and showed Chapter 1 / Preview / paragraph 1.
SAC-196 is Done; later chapter imports remain outside this completed first
chapter slice. Both the cloud reader and the private Tailscale service have
this build.

## SAC-207 — Direct OpenAI assistant, 2026-09-15

Requested change: replace the Mac/Codex CLI relay with the OpenAI API while
carrying the learning context. Work is on `codex/openai-cloud-assistant`.

Production now uses the OpenAI API directly. The Mac relay is stopped and its
automatic restart removed. The release and real provider evidence are recorded
below. SAC-207 is complete. The earlier QA phase waited for the user to place an
API key in the project `.env`; that key was then provisioned as a Worker secret.

The Worker now starts GPT-6 Astra Responses with low reasoning, standard service,
and a 6,000-token output limit. D1 retains the provider response ID, request,
result, usage, and price snapshot. A minute cron collects background replies
when the browser is closed. No Codex process or Mac polling loop exists in the
new code. The optional Python preview only serves assets and proxies cloud API
requests; it does not open the historical SQLite ledger.

Each question explicitly carries the paragraph, source pages, exact highlight
anchor, paragraph notes, current messages, ancestor conversations, message
notes, selected reply ID, and visual state. Existing conversation IDs and study
snapshots remain intact. A separate branch anchor distinguishes the paragraph
or answer that started a branch from the highlight being asked about now.
The anchored quote takes precedence over an older preview description. Full
context is retained rather than silently truncated or tied to provider history.

Submission is claimed in D1 before contacting OpenAI. Reconnect retrieves the
same response. If submission acknowledgement is lost, the job is marked uncertain
and is never sent again automatically. Poll failures preserve the response ID
and original error. Legacy answers remain available; pending CLI calls cannot
be silently rerun through a paid API. API keys stay in Worker secrets.

Usage includes input, cached input, cache writes, output, and reasoning tokens.
Cost is an estimate from the price snapshot recorded when the call starts.
Cached and cache-write tokens are deducted from ordinary input before pricing;
reasoning is already counted in output. Unknown usage and legacy dollar charges
remain unknown. Totals include the priced subtotal and count of unpriced replies.
Official Responses, background, conversation-state, prompt-caching, and GPT-6
Astra pricing documentation was checked on 2026-09-15; links are in web/README.md.

Verification completed:
- 37 Node tests, 3 Python tests, TypeScript, and the production Wrangler dry run
  passed. Tests use real SQLite and stubbed OpenAI responses; they do not prove
  live OpenAI access. Coverage includes nested context, costs, concurrent
  submissions, lost acknowledgements, reconnects, and scheduled collection.
- Migration 0003 was applied to the separate QA D1 database only. It adds provider
  and recovery fields while keeping the two legacy QA assistant records intact.
  The final QA deployment is `14f92904-5c93-463f-968f-1a0f7041126e` on
  learning-threads-sync-qa, with the minute collector configured.
- External Brave opened the QA study through the optional preview on port 63406.
  The spherical highlight opened the original wrist thread and the nested
  actuation highlight opened its conversation. Existing replies and the wrist
  draft remained visible.
- Submitting the existing QA question "Can a sensor ever affect the motion it
  measures?" displayed the missing-key error with Reconnect. QA D1 version 33
  retained request `amu29p1x0-aca0ag951uf`, its exact answer highlight, replyTo m7,
  ancestors p1/b3, all six ancestor messages, the two current messages, source
  paragraph 2.2.1-p2, and spherical visual controls. The assistant ledger remained
  at two legacy calls: no provider call or charge was made.

Cutover checklist (completed below):
1. Provision OPENAI_API_KEY in QA and complete a real Brave follow-up. Read back
   its provider ID, token usage, cost calculation, and background recovery.
2. Provision the production secret. Verify old Mac jobs are finished and retain
   the historical local ledger. Stop the LaunchAgent and prevent restart at login.
3. Apply production migration 0003 and deploy the Worker immediately. The old
   Worker assumes the original table shape; do not roll its code back alone.
4. Continue an existing production conversation in Brave with the Mac service
   stopped. Check source links, context, usage, reload, and active 100% deployment.

The initial checks above used stubbed responses or the missing-key path. The
following verification uses real OpenAI responses. SAC-193's exported-file
verification and SAC-197's generated/interactive answer visuals remain separate.

### Live API and production cutover

The user supplied `.env` on 2026-09-15. It remains Git-ignored and mode 0600.
The key was read without printing it and sent through stdin to Wrangler's
secret command for QA, then production. It was not placed in frontend assets;
a byte-level check of every deployed asset confirmed its absence.

External Brave resumed the saved actuation question in QA. OpenAI response
`resp_0708bae717595b5b006aa8e80962c087d2871ffc92ccda845a` completed with 1,960
input tokens, 1,957 cache writes, and 278 output tokens. Its answer explicitly
connected the selected sensor claim with the earlier spherical-wrist discussion.
The per-answer Usage disclosure showed the actual token counts and estimated
API cost (about $0.0383925). A second follow-up used the equation from that answer.

Background proof: Brave submitted request `amu2ayod1-4seqtsrdik3` and closed the
tab while it displayed Thinking. At 06:40:41 UTC, a read-only usage request found
the job still running with provider response
`resp_04ce8bcbeb40e247006aa8e85aee6487d2b8562fa4858a5849`. No reply-poll endpoint
was called after closing the tab. The Cloudflare collector saved completion at
06:41:04 UTC, before the page was reopened. Reopening restored the complete
worked example, diagram, units, assumptions, and cost. QA D1 version 42 retained
all three new exchanges. Their calculated cost subtotal was $0.1357525; each
record was independently checked against its reported usage and saved prices.

Before cutover, both the local SQLite ledger and production D1 contained six
completed legacy calls and no pending jobs. The Mac LaunchAgent was unloaded;
its plist was moved out of LaunchAgents to prevent restart. A consistent SQLite
backup and the old Tailscale configuration are preserved under:
`/Users/sachin/Library/Application Support/LearningThreads/retired-mac-relay-20260915T064207Z/`.
Only Learning Threads ports 8080 and 8443 were removed from Tailscale Serve.
The unrelated port 443 route is unchanged. Port 63402 has no listener.

Production migration 0003 applied successfully. Worker version
`66f6bdd5-7ed5-4a72-b63f-36118c6070bf` is active at 100% traffic on
https://learn.voxdez.com. The minute collector is deployed. The pre-deploy dry
run passed; no implementation changes were needed after the 37 Node / 3 Python
tests and TypeScript checks in the prior phase.

With the Mac service stopped, Brave continued the existing Chapter 1 cup-reaching
answer. Request `amu2b2xah-ec6cnryhzw` carried paragraph `mr-ch01-p001`, printed
page 1 / PDF page 21, replyTo m6, and all four earlier messages m3–m6. Response
`resp_06392f21c24a2dda006aa8e9211fcc87d293519432fad844c7` completed at 06:43:51 UTC
with 745 input and 142 output tokens, costing an estimated $0.01455. The answer
explained alternative arm postures and included a text diagram. The production
Usage disclosure matched the provider record. Reload retained all six messages;
D1 version 15 contained the context, request, and new answer. All six legacy call
records remain unchanged with their unknown dollar charges.

An older user-owned production tab showed its existing stale-tab warning. It
was left intact; verification used a fresh production tab to preserve that
older tab's work.
