# Learning Threads web app

The full-page version of the approved reading experiment.

Includes two book paragraphs, movable joint diagrams, sample conversations,
nested branches, text highlights, and notes. The reading-view menu changes
layout, text size, and surrounding context.

Reading state is saved in this browser: the current paragraph or thread,
highlights, notes, saved questions and drafts, replies, read marks, reading preferences,
and visual controls. Closing the tab and opening the same origin resumes it.
Browser data deletion removes this local copy. Cloud sync is not wired yet.

`reading.html` is the editable source. Build with `python3 web/build.py` from
the repository root. This generates a normal `index.html`, with inline scripts
covered by CSP hashes. It needs no chat runtime or visualization exporter.
`exported.html` and `unwrap_preview.py` are the historical preview path; do not
use them for current builds.

Serve the reader and assistant together:

```sh
python3 server/assistant.py --site web --data /tmp/learning-threads-dev --codex /Applications/ChatGPT.app/Contents/Resources/codex --port 63403
```

Open `http://127.0.0.1:63403/`. A plain static server can display the reader but
cannot run the assistant.

Private Tailscale preview:
`https://sachins-macbook-pro.tailde98db.ts.net:8443/`

Direct address when the device cannot resolve the Tailscale hostname:
`http://100.117.88.81:8080/`. This is a private Tailscale TCP forward to the same
loopback server. It avoids DNS and does not enable public access. Configure it
with `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --tcp=8080 127.0.0.1:63402`.
The user confirmed this address works on sixsac; use it as the preview link.
Ask Codex uses same-origin HTTP requests, so it works on the direct Tailscale
address without clipboard access. Each origin has its own browser study storage.

Deploy with `python3 scripts/deploy-tailscale.py` from the repository root.
The script builds and copies `index.html` into
`~/Library/Application Support/LearningThreads/site`, with the assistant server
outside the served directory. A user LaunchAgent keeps the server on loopback
port 63402 running, and Tailscale Serve exposes it on
HTTPS port 8443. The Mac must be awake, signed in, and connected to Tailscale.
Existing Tailscale routes are preserved. No Funnel or public endpoint is used.
This is a private preview, not the planned Cloudflare deployment or device sync.
Browser study storage remains separate for each origin and device.

To stop this preview, run
`/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=8443 off`,
`/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --tcp=8080 off`,
then `launchctl bootout gui/$(id -u)/com.sachinkundu.learning-threads`.
Its LaunchAgent is `~/Library/LaunchAgents/com.sachinkundu.learning-threads.plist`.

Open `/?example=wrist` for the thread example based on the spherical-wrist
question from our conversation. Visualize adds an explanation to the same
conversation. Actuation and Torque demonstrate two deeper branches, with
direct return paths, answer notes, and retained visual controls.

The original wrist answer is adapted from our chat; deeper replies and visuals
are prepared examples. Ask Codex now returns live replies for new questions
and for previously saved unanswered questions. There are no automatic question
suggestions. Example URLs seed a fresh session only; an
existing saved place takes precedence when reopening.

Open `/?example=highlight` to see the wrist discussion anchored to the exact
spherical-joint sentence. Click the highlighted text to reopen the discussion;
Back to highlight returns to that range. The source quote also appears with
the original question. This demonstrates the required two-way connection.
Select text in either book paragraph or an answer to ask about that exact
range. Ask Codex saves the question and its source link before starting the reply. A book selection
starts its own thread; answer follow-ups stay in the current thread unless
Explore separately is used. Overlapping highlights offer their linked
questions, while highlighted joint terms and citations retain their actions.
Back to highlight returns to the exact source and focuses it.

Edit a saved question with Edit and Save question. Earlier wording is kept in
History. Paragraph and answer notes also keep earlier versions when an edit
ends. Reloading restores questions, note history, and unfinished edits. Existing
version 1 study data upgrades without resetting it. Device sync is in SAC-193.

`thread-examples.js` and `thread-examples.css` contain the thread-specific
content and presentation. `study-links.js` handles exact source ranges,
overlapping highlights, and edit history. `study-store.js` validates and saves versioned
snapshots under a book-specific localStorage key. Failed writes keep the last
good copy. An error exposes a backup download containing both the current
work and the stored copy. Corrupt or incompatible data is never reset silently.

Run `node --test tests/*.test.cjs` and
`python3 -m unittest discover -s tests -p "test_*.py"` from
the repository root. These checks cover restoration, source identity, overlapping
ranges, revision history, migration, broken thread links, quota errors, stale
tabs, corrupt data, and denied storage. They are local checks, not cloud evidence.

The local store detects a previously saved change from another tab and stops
that stale tab from overwriting it. It is not a concurrent editing protocol;
atomic cloud updates and conflict recovery belong to SAC-193.

Follow the UI removal test in the root `AGENTS.md`. The reading interface has
no permanent thread map, depth labels, walkthrough copy, or prototype status
text. Prototype limitations belong in this document.

## Live Codex bridge

The host runs the app-bundled Codex CLI 0.153.4 with `codex exec --json`, using
its existing ChatGPT login and `gpt-6-astra` at low reasoning effort. The older
standalone CLI 0.150.1 was rejected by the provider for this model. No login
credentials are copied, served, or stored in this repository. No API key is used.

Each invocation receives the question, passage, exact source anchor, relevant
ancestor conversations, and earlier replies. It runs in a temporary empty
workspace with a read-only sandbox, user configuration excluded, and shell,
plugins, apps, browser, image generation, and delegation features disabled.
Only the answer is rendered, through an HTML-escaping Markdown renderer. Text
diagrams are supported; generated images and interactive live visuals remain
SAC-197. The approved prepared visuals remain available.

The private server stores request IDs, results, errors, and provider-reported
usage in `~/Library/Application Support/LearningThreads/data/assistant.sqlite3`.
Its data directory is private and never served. The server binds only to
loopback. API requests require the app header and an allowed host/origin;
there is no cross-origin API access. Tailscale supplies remote access.

One call runs at a time, with at most four queued/running requests. Repeated
submission of the same request ID returns the existing job. Reloading or closing
the tab does not start another model call. Network failures offer Reconnect for
the same request; a failed call offers Retry as a separate, counted attempt.
A server restart marks unfinished work as interrupted rather than rerunning it.
Deployment refuses to interrupt queued or running work. Replies time out after
three minutes with the original error retained.

Usage shows individual calls and totals for input, cached input, output, and
reasoning tokens where reported. Unknown usage stays unknown. The CLI does not
report a dollar charge with this ChatGPT login, so Cost is “Not reported”; no
API-equivalent price or zero-dollar claim is substituted. Failed attempts stay
in the ledger. The full study state still lives in this browser; the server's
reply ledger does not provide cross-device study sync.

Official command reference: https://learn.chatgpt.com/docs/non-interactive-mode
