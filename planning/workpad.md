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
- General selected-text thread anchors and revision history are SAC-192.
- Two paragraphs remain loaded. Full chapter/source checking is SAC-196.
