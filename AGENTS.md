# Learning Threads project instructions

## Delivery

- Use the external Brave browser for sign-in, review, and browser testing.
- No OpenSpec for this project. Work directly from the prioritized Linear backlog.
- Keep technical decisions and verification evidence in `planning/workpad.md`.
- Preserve the approved reading and thread UI while replacing temporary behavior.
- Distinguish browser persistence from cloud sync, and sample replies from live assistant calls.
- Keep test conversations in the isolated QA app. Do not leave test exchanges in the learner's production reading.
- Build with `python3 web/build.py`; the old visualization export files are historical.
- Assistant answers use the OpenAI API from Cloudflare. Do not add a Mac service or Codex CLI dependency.
- Carry the full source, exact highlight, notes, visual state, and ancestor/current conversation context with each question. Preserve existing conversation and source IDs when changing the harness.

## UI removal test

Apply this test to every UI element before adding it or keeping it:

> If removed, will it be okay? If yes, delete it.

- Avoid commentary about the UI. Do not narrate what the interface does or reassure the learner that navigation, saving, or threads work.
- Remove redundant headings, labels, badges, status summaries, navigation panels, and helper paragraphs. Do not replace removed text with different wording that serves the same unnecessary purpose.
- Keep prototype details, API wiring, prepared-response notices, token-metering limitations, and implementation explanations in project documentation, not in the reading experience.
- Use “Back to highlight” or a direct return to the parent. Do not show a permanent thread map, ancestry commentary, or labels such as “Side thread · level 1”.
- Preserve meaningful learning content: source passages, answers, equations, visuals, and citations. These teach the subject; they are not UI commentary.
- Preserve the exact highlight-to-thread link, essential actions, accessible names, and actionable errors. Avoid duplicate ways to explain or navigate the same connection.
- Do not add automatic follow-up question suggestions.

This rule applies to all future screens and edits in this project.
