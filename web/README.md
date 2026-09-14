# Learning Threads web app

The full-page version of the approved reading experiment.

Includes two book paragraphs, movable joint diagrams, sample conversations,
nested branches, text highlights, and notes. The reading-view menu changes
layout, text size, and surrounding context.

Reading state is saved in this browser: the current paragraph or thread,
highlights, notes, question drafts, replies, read marks, reading preferences,
and visual controls. Closing the tab and opening the same origin resumes it.
Browser data deletion removes this local copy. Cloud sync is not wired yet.

`reading.html` is the editable source. Build with `python3 web/build.py` from
the repository root. This generates a normal `index.html`, with inline scripts
covered by CSP hashes. It needs no chat runtime or visualization exporter.
`exported.html` and `unwrap_preview.py` are the historical preview path; do not
use them for current builds.

Serve this folder with a local HTTP server to review it in a browser.

Private Tailscale preview:
`https://sachins-macbook-pro.tailde98db.ts.net:8443/`

Direct address when the device cannot resolve the Tailscale hostname:
`http://100.117.88.81:8080/`. This is a private Tailscale TCP forward to the same
loopback server. It avoids DNS and does not enable public access. Configure it
with `/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --tcp=8080 127.0.0.1:63402`.
The copy action uses its manual-copy fallback if the browser requires HTTPS
for clipboard access. Each origin has its own browser study storage.

Deploy with `python3 scripts/deploy-tailscale.py` from the repository root.
The script builds and copies only `index.html` into
`~/Library/Application Support/LearningThreads/site`. A user LaunchAgent keeps
the loopback server on port 63402 running, and Tailscale Serve exposes it on
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
are prepared examples. There are no automatic question suggestions. Copy for
Codex still copies a prompt and context. No live model connection, model usage,
or cost figures are claimed. Example URLs seed a fresh session only; an
existing saved place takes precedence when reopening.

Open `/?example=highlight` to see the wrist discussion anchored to the exact
spherical-joint sentence. Click the highlighted text to reopen the discussion;
Back to highlight returns to that range. The source quote also appears with
the original question. This demonstrates the required two-way connection.
General highlights now persist as text ranges, with exact source checks on
load. General question-to-highlight links and note revision history are in
SAC-192. Device sync is in SAC-193.

`thread-examples.js` and `thread-examples.css` contain the thread-specific
content and presentation. `study-store.js` validates and saves versioned
snapshots under a book-specific localStorage key. Failed writes keep the last
good copy. An error exposes a backup download containing both the current
work and the stored copy. Corrupt or incompatible data is never reset silently.

Run `node --test tests/study-store.test.cjs` from the repository root. These
checks cover restoration, broken thread links, quota errors, stale tabs, corrupt
data, and denied storage. They are local persistence checks, not cloud evidence.

The local store detects a previously saved change from another tab and stops
that stale tab from overwriting it. It is not a concurrent editing protocol;
atomic cloud updates and conflict recovery belong to SAC-193.

Follow the UI removal test in the root `AGENTS.md`. The reading interface has
no permanent thread map, depth labels, walkthrough copy, or prototype status
text. Prototype limitations belong in this document.
