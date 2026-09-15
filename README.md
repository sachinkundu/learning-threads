# Learning Threads

A web app for studying books one paragraph at a time. Read at your own pace,
highlight a passage, ask a question, and explore nested conversations that stay
linked to the exact source. Notes, highlights, and reading history sync across
devices through Cloudflare.

- Questions and nested threads have fixed links that can be bookmarked.
- Assistant equations and tables render clearly while saved source highlights stay intact.
- Book figures appear with the passages that refer to them.
- Original PDF pages stay hidden until opened.
- Assistant settings offer Astra, Sol, Terra, and Luna, with Luna/High by default.
- Codex can build animations inside answers and revise them in follow-ups.
- Usage sums tokens by model and retains earlier API cost records.

The current book is *Modern Robotics* by Kevin Lynch and Frank Park. Chapter 1
has checked web text, source-page images, and Figure 1.1. The full PDF is not
included. Additional chapters and books are planned.

## Development

Requires Node.js and Python 3.

```sh
npm ci
python3 web/build.py
npm test
npm run check
npm run test:server
```

The editable reader is `web/reading.html`. The build creates `dist/` and embeds
the checked book catalog and client scripts. See [web/README.md](web/README.md)
for the assistant, persistence model, and local preview instructions.

## Cloudflare deployment

The app uses Workers, D1, R2, a Cloudflare Sandbox runner, and Cloudflare Access. Replace the
account, database, domain, Access audience, issuer, and owner settings in
`wrangler.jsonc` with your own values before deployment. Configure Access for
your domain, then apply the D1 migrations and deploy the private runner:

```sh
npx wrangler d1 migrations apply learning-threads-study --remote
rtk proxy npx wrangler r2 bucket create learning-threads-codex
rtk proxy npx wrangler deploy --config wrangler.codex.jsonc
rtk proxy node scripts/seed-codex-auth.mjs
npx wrangler deploy
```

The seed script installs the current Codex ChatGPT login in encrypted R2 storage.
It keeps its encryption key in a Worker secret and a private local file. It never
copies login values into source or build output. Run it again after a new sign-in
if the cloud login needs reconnecting, while no cloud answer is running.

The runner uses the selected model and reasoning level with OAuth subscription
access. It has no API-key fallback. Jobs share one refresh owner; refreshed login
data is stored even when a later model or tool step fails. Each answer keeps its
visual source files in R2. A follow-up receives those files and creates a new
version. Visuals run in opaque sandboxed frames with network access disabled.

`.env.example` is a historical API configuration template. `.env` files,
local Wrangler secrets, dependencies, and build output are excluded from Git.
Credentials belong in server-side secrets and must not be placed in book data,
client code, or generated assets.

Work is tracked in Linear. Project rules are in [AGENTS.md](AGENTS.md), and
implementation choices and verification evidence are in
[planning/workpad.md](planning/workpad.md).
