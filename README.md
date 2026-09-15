# Learning Threads

A web app for studying books one paragraph at a time. Read at your own pace,
highlight a passage, ask a question, and explore nested conversations that stay
linked to the exact source. Notes, highlights, and reading history sync across
devices through Cloudflare.

- Book figures appear with the passages that refer to them.
- Original PDF pages stay hidden until opened.
- Assistant settings offer Astra, Sol, Terra, and Luna, with Luna/High by default.
- Each answer records its model, reasoning level, token usage, and estimated cost.

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

The app uses a Worker, D1, static assets, and Cloudflare Access. Replace the
account, database, domain, Access audience, issuer, and owner settings in
`wrangler.jsonc` with your own values before deployment. Configure Access for
your domain, then apply the D1 migrations and provision the Worker secret:

```sh
npx wrangler d1 migrations apply learning-threads-study --remote
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Use `.env.example` as an empty template if you keep a local key. `.env` files,
local Wrangler secrets, dependencies, and build output are excluded from Git.
Credentials belong in server-side secrets and must not be placed in book data,
client code, or generated assets.

Work is tracked in Linear. Project rules are in [AGENTS.md](AGENTS.md), and
implementation choices and verification evidence are in
[planning/workpad.md](planning/workpad.md).
