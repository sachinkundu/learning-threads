# Learning Threads browser prototype

The full-page version of the approved reading experiment.

Includes two book paragraphs, movable joint diagrams, sample conversations,
nested branches, text highlights, and notes. The reading-view menu changes
layout, text size, and surrounding context.

Notes and conversations last for the browser session only. Sample replies are
prepared examples. Copy for Codex copies the question and its context; this
page has no live model connection or token-cost tracking.

`reading.html` is the editable source fragment. Render it with the visualization
skill's `scripts/render.py` into `exported.html`, then run `unwrap_preview.py`
to produce the normal full-viewport `index.html`.

Serve this folder with a local HTTP server to review it in a browser.

Open `/?example=wrist` for the thread example based on the spherical-wrist
question from our conversation. Visualize adds an explanation to the same
conversation. Actuation and Torque demonstrate two deeper branches, with
direct return paths, answer notes, and retained visual controls.

The original wrist answer is adapted from our chat; deeper replies and visuals
are prepared examples. There are no automatic question suggestions. Notes,
thread state, and reading positions remain in memory until the page reloads.
No live model usage or cost figures are claimed.

Open `/?example=highlight` to see the wrist discussion anchored to the exact
spherical-joint sentence. Click the highlighted text to reopen the discussion;
Back to highlight returns to that range. The source quote also appears with
the original question. This demonstrates the required two-way connection.
General highlight storage, revision history, and cross-device persistence are
still requirements for the finished app, recorded in the Linear brief.

`thread-examples.js` and `thread-examples.css` contain the thread-specific
content and presentation. `unwrap_preview.py` bundles them into `index.html`
to keep the export's content security policy intact.

Follow the UI removal test in the root `AGENTS.md`. The reading interface has
no permanent thread map, depth labels, walkthrough copy, or prototype status
text. Prototype limitations belong in this document.
