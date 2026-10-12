# apps/web

The Cloudflare Worker (JSON API + static UI) and its D1 database. Spec: `spec/SPEC-web.md`. UI decisions: `docs/UI.md`. **Ask Mattan before any visual or interaction change.**

## Commands (run here)

```
npm install
cp .dev.vars.example .dev.vars   # once: local PRINTER_TOKEN (git-ignored)
npm run db:migrate:local         # once per fresh checkout (local D1 lives in .wrangler/state)
npm run dev                      # http://localhost:8787
npm test                         # vitest inside the Workers runtime
npm run typecheck                # Worker + tests (tsconfig.json), then UI JS (tsconfig.public.json)
npm run build                    # wrangler deploy --dry-run: bundles only, no account, no upload
```

Deploying and remote D1 are Phase 4 and need Mattan's OK.

## Layout

- `src/index.ts`: URLPattern router. `/api/*` runs here (`run_worker_first`); everything else is `public/`.
- `src/items.ts`, `src/printer.ts`: route handlers. `src/validate.ts`: pure input checks. `src/db.ts`: all SQL, always bound.
- `public/`: the UI. No framework, no build step. `app.js` and `swipe.js` are `// @ts-check` JS; pure helpers in `lib.js` are unit-tested.
- `migrations/`: D1 schema. Changing it needs Mattan's OK.

## Gotchas

- **Tests share storage.** `@cloudflare/vitest-plugin` doesn't isolate storage per test, so `test/setup.ts` applies the migrations and clears the tables before every test.
- **`exports.default.fetch` in tests skips asset routing**, so the Worker passes non-API paths to `env.ASSETS` itself. Its type comes from `Cloudflare.GlobalProps.mainModule` in `src/env.d.ts`.
- **Printer routes fail closed:** no `PRINTER_TOKEN` gives `503`, a wrong one `401`. Tests set the token in `vitest.config.ts`.
- **Phone vs laptop** is decided by `(hover: hover) and (pointer: fine)`. Phone actions are swipes; laptop actions are words on tap.
- **A delete is sent only when its undo line goes away**, or the view flips, or the page hides (`keepalive`).
- **npm 12 blocks install scripts** (workerd, esbuild). Their binaries still work; look here first if `wrangler dev` won't start.
- **Checking the UI:** `npm run dev`, then Chrome's device toolbar for phone size (a mouse drag acts as a finger there). Phase 1 drove headless Chrome over the DevTools protocol with throwaway scripts (not in the repo).
