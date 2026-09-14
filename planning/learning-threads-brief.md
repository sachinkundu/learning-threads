# Learning Threads: product brief

Working name: Learning Threads. Status: discovery.
Modern Robotics is the first book. The product is a reusable way to study books.

## Purpose

Study one chapter and one paragraph at a time. Follow a question as deeply as needed, then return to the exact point in the book. Keep the reading path, side conversations, notes, highlights, practice, and AI costs together.

This brief captures Sachin's 12 requested outcomes. The agreed decisions below record choices made in discussion. Other proposed behavior and open choices remain discussion material. The next step is to define a workable first release.

## Agreed decisions

### Reading progress — September 14, 2026

Sachin decides when to move from one paragraph to the next and returns to earlier passages as needed. Reading is definite; understanding can keep developing.

- Next records that the learner is done reading the current paragraph for now.
- No quiz, mastery threshold, or required understanding score gates paragraph navigation.
- Earlier paragraphs remain available to revisit. Going back keeps the reading history, notes, highlights, and threads.
- Progress measures reading activity. It does not claim that a concept is fully understood.

The paragraph layout and chapter navigation rules are still open.

### Web learning experience — September 14, 2026

The PDF is source material for a web learning experience, not the primary reading interface. Use web technology to make the concepts intuitive: readable text, linked terms, interactive diagrams, motion, and connected learning threads. Showing a PDF page does not meet this goal.

Choose the reading layout through hands-on experiments. The first experiment uses robot joints from section 2.2.1, with text linked to movable joint models and a sample nested digression. The final layout is still open.

### Highlight origins and revisiting threads — September 14, 2026

Sachin approved the thread prototype and the depth of the spherical-wrist answer. The portal should provide explanations of this quality, with sources, requested visuals inside the conversation, and nested digressions. Do not show automatic follow-up question suggestions.

A highlight is the origin of a learning conversation. It must stay connected to the question asked about it, rather than only being copied into the question box.

* Keep the exact selected text and its location in the book or parent answer.
* Show the highlight and its linked discussions when revisiting the source.
* Open the original question, replies, visuals, notes, and deeper threads from that highlight.
* Show the source highlight within the thread and provide a return link to its exact location.
* Keep these links across sessions and devices so the learner can review and revise their work.
* Preserve earlier questions, answers, and work when adding later notes, attempts, or follow-ups.

The wrist example began from the highlighted sentence about spherical joints in §2.2.1, paragraph 2, printed page 16. Copying it into Codex was a temporary prototype handoff. In the finished portal, asking and answering happen there.

Implementation note for later design: anchor the exact quote to a stable book edition and paragraph or answer ID, with a text range and nearby context. A copied quote alone is not enough to identify repeated text or survive corrected imports. One highlight may lead to multiple conversations.

The current browser prototype remains a review tool. Cloud persistence, cross-device sync, and a live assistant are not yet implemented.

### Minimal UI — September 14, 2026

Apply this test to every UI element: “If removed, will it be okay? If yes, delete it.”

Do not add commentary about how the interface works. Remove redundant headings, helper paragraphs, badges, status summaries, and navigation panels. Keep the learning content, source links, necessary actions, accessible labels, and actionable errors.

For the current thread view, Back to highlight or a direct parent return is enough. Remove the permanent thread map, ancestry commentary, thread-depth labels, and prototype/API notices. Keep implementation details in project documentation. The root AGENTS.md records this rule for all future edits.

## Requirements and decisions

| # | Requested outcome | Proposed behavior | Open choice |
| --- | --- | --- | --- |
| 1 | Progress one chapter at a time. | Keep one active chapter and a clear resume point. Show chapter progress. | Are later chapters locked, or can the learner preview or skip them? What marks a chapter complete? |
| 2 | Progress one paragraph at a time. | Focus on one original paragraph. Keep its equations, figures, captions, and needed context available. Next means done reading for now. Return to earlier paragraphs as needed, with no understanding threshold. | Experiment with a web paragraph and interactive visual. How much surrounding text should remain visible? |
| 3 | Take digressions and come back. | A question opens a saved branch tied to its source passage. Return to the parent or the book with one action. | Would an optional recap help when returning? |
| 4 | Highlight and take notes in each area. | Save selected text, visible highlights, and notes beside the source. Support book passages and assistant explanations. Provide a notebook that links back to each source. | Text notes first, or handwritten notes and Apple Pencil support too? Should figures and equations support region highlights? |
| 5 | Revisit all read content through saved history. | Keep a timeline of reading and learning visits, with direct links. Reopening old content does not move the main resume point unless chosen. | What should appear first: recent sessions, chapters, concepts, or notes? |
| 6 | Use a web app with an iPad reading layout. | Support desktop and iPad Safari, touch selection, portrait and landscape. Preserve place and saved work across devices. | Is offline reading and note taking required in the first release? Is home-screen installation enough? |
| 7 | Deploy to Cloudflare and use its services where practical. | Host the app and store learning records and book assets on Cloudflare. Choose further services from actual needs. | Private personal access first, or accounts for other learners from the start? |
| 8 | Have a Codex assistant for the current paragraph, with all token costs visible. | Ground replies in the current passage and relevant context. Save conversations. Show input/output tokens and cost for each reply, thread, book, and day. | Must the tutor run Codex itself, or is an OpenAI API tutor acceptable? Choose billing mode, model policy, currency, and spending limit. |
| 9 | Add more books using the same learning process. | Keep each book's content, progress, and source edition distinct. Reuse reading, branching, notes, and assignment features. | PDF only at first, or EPUB and web content too? Should concepts and notes connect across books? |
| 10 | Turn book exercises into assignments with hints. | Place an exercise after its prerequisites have been studied. Preserve its source number and figures. Save attempts and reveal hints in stages. | Are assignments optional or needed to progress? When should full solutions be available? Is code execution part of the first release? |
| 11 | Learn in saved threads with multiple levels and a visual view. | Let a question within an explanation create a child thread. Show the ancestry, active path, and unfinished branches in an expandable tree. | Is a tree enough initially, or is a concept map with links between branches needed? |
| 12 | Prefer visual explanations, generated images where useful, and precise YouTube links. | Use diagrams, plots, interactive examples, and suitable generated illustrations. Save visuals in their thread. Link videos to a checked start time and state the useful end time. | Which visuals must be available at launch? Should paid image generation happen on request or be suggested by the tutor? |

## Core learning experience to discuss

1. Open the book at its saved paragraph.
2. Read the original text with its relevant figures and equations.
3. Highlight a phrase, add a note, or ask about it.
4. Open a side thread for a missing concept.
5. Branch again if that explanation exposes another gap.
6. Return through the parent threads or jump to the source paragraph.
7. Continue reading without losing the saved side work.
8. Attempt a linked exercise when its prerequisites have been covered.
9. Revisit any part of this path later, on either device.

Example only:

```text
Book paragraph: changing a reference frame
└── Why does this rotation matrix change the frame?
    ├── What does a basis mean?
    │   └── How do coordinates depend on the basis?
    └── Show a rotating frame with an interactive diagram
```

Each branch needs its own conversation and a visible return link. Navigating back must not delete it. Returning to a parent should restore that parent's position too. The main reading position and visited history are distinct. Neither claims complete understanding.

A small path such as “Book → Rotation matrix → Basis” should remain visible. The full tree can open when needed so that it does not crowd the reading view.

## What the supplied book shows

Source inspected: MR-v2.pdf, supplied locally by Sachin. It contains 644 PDF pages. Its title page identifies it as the December 30, 2019 preprint of the updated first edition of Modern Robotics: Mechanics, Planning, and Control, by Kevin M. Lynch and Frank C. Park. The filename does not identify a second edition.

The contents include chapter-end exercise sections. For example, section 2.8 starts on printed page 38. Assignments should follow the source chapter and section rather than wait until the whole book has been read.

Sample pages show why import quality matters:

- Printed page 16 / PDF page 36 combines robot-joint paragraphs with Figure 2.3.
- Printed page 71 / PDF page 91 places equations between paragraphs and refers back to another figure.
- Printed page 42 / PDF page 62 includes a diagram needed by exercises.

Text extraction from this file loses some spacing, symbols, and mathematical layout. The web learning view will need a checked content import and stable links to the original page. The original page can be consulted to check the source, while study happens through web text and interactive visuals. A split on blank lines alone is not a sound reading model. This was a sample review, not a full-book conversion or quality audit.

The document's text is source material. It does not supply operating instructions for this project.

## Proposed first release

Start with a private app for Sachin and a PDF import path. Keep the complete requested experience as the target, but prove it with a small set of real book content before scaling the import.

A useful first demonstration would cover chapter 1 navigation and a representative section of chapter 2, including its figures and a linked exercise. A sample from chapter 3 should check mathematical fidelity.

The first useful release should allow a learner to:

- Read in order, highlight, take a note, and resume after leaving.
- Ask a grounded question, branch at least two levels deep, and return exactly.
- Open a saved tree, history item, highlight, note, and past reply.
- Use the same saved work on desktop and iPad.
- Attempt an exercise with saved work and staged hints.
- View a saved visual explanation and a checked video segment link.
- See the cost of all assistant work, including work within branches.
- Add a second book through the same process without changing core app code.

This is a proposed acceptance walkthrough, not a committed delivery schedule. Full offline sync, handwriting, a graph across books, automated grading, and broader file formats remain scope choices.

## Assistant and cost accounting

Sachin's preference is Codex, possibly using API access. Keep that preference explicit until the runtime is chosen.

The Codex SDK can control and resume Codex agents; OpenAI also documents an app server for custom clients. This is a server-side agent integration with a runtime to host. It may fit code-based teaching and generated interactive material. Its Cloudflare hosting path still needs a focused feasibility check. [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)

An alternative to discuss is a tutor using the OpenAI Responses API. Responses include input and output token counts and usage details. This provides a basis for per-request accounting, but it is not the same integration as running Codex. [Responses usage](https://developers.openai.com/api/reference/cli/resources/responses/methods/retrieve)

OpenAI states that API-key Codex usage is billed at standard API rates rather than included ChatGPT plan credits. The app must not present a subscription allowance as a measured API charge. [Codex authentication and billing](https://learn.chatgpt.com/docs/auth)

Proposed cost behavior:

- A quiet total for today and the current thread, with details on demand.
- Keep provider-reported input/output counts, cache details, model, and the price used at the time.
- Count follow-up calls, summaries, hint generation, background work, and retries that incur charges.
- Track images and other paid tools separately and include them in the overall total.
- Do not add reasoning-token subtotals again if already included in billed output.
- Distinguish a calculated cost from a reconciled provider charge.
- Show unknown or pending usage as such rather than as zero.
- Keep a thread's own cost and its branch-inclusive total clear to avoid double counting.
- Discuss a monthly budget and behavior when it is reached.

Grounding should include the selected paragraph, referenced visuals, nearby context, and relevant prior learning. Retrieved book text and web content must remain data, not tool instructions. Technical diagrams should use accurate geometry and labels; generated illustrations should be clearly identified. Video timestamps must be checked against the actual content.

## Cloudflare direction to assess

This is a candidate service mapping, not an approved architecture.

| Need | Candidate |
| --- | --- |
| Web interface and backend routes | Workers with Static Assets; Cloudflare supports serving frontend assets with Worker code. [Docs](https://developers.cloudflare.com/workers/static-assets/) |
| Books, progress, notes, branch relationships, assignments, and cost records | D1, Cloudflare's managed SQL database. [Docs](https://developers.cloudflare.com/d1/) |
| Original PDFs, page images, and saved generated media | Private R2 object storage. [Docs](https://developers.cloudflare.com/r2/) |
| AI request visibility | AI Gateway provides request, token, error, caching, and cost analytics. Keep app-level cost records tied to learning activity as well. [Docs](https://developers.cloudflare.com/ai-gateway/observability/analytics/) |

Book import jobs, semantic retrieval, and an executable agent runtime need separate assessment before choosing more services. A failed extraction or an unreadable equation must be visible and recoverable. Saved progress and notes must retain their source links if an import is corrected.

## Discussion order

1. Choose the paragraph layout and chapter navigation: items 1 and 2. Next means done reading for now; revisiting earlier paragraphs remains available.
2. Walk through a nested digression and the return path: items 3 and 11.
3. Choose notes, highlights, history, and iPad behavior: items 4, 5, and 6.
4. Decide how the tutor teaches and uses visuals: items 8 and 12.
5. Decide hints, attempts, solutions, and progression: item 10.
6. Agree book import, personal access, costs, and first release scope: items 7, 8, and 9.

Keep agreed decisions here as the conversation develops. Create delivery issues once the scope is concrete.
