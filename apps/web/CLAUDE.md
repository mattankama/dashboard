# apps/web

The Cloudflare Worker (JSON API + static UI) and its D1 database. Spec: `spec/SPEC-web.md`. UI decisions: `docs/UI.md`. **Ask Mattan before any visual or interaction change.**

## Commands (run here)

```
npm install
cp .dev.vars.example .dev.vars   # once: local PRINTER_TOKEN, optional login (git-ignored)
npm run db:migrate:local         # once per fresh checkout (local D1 lives in .wrangler/state)
npm run dev                      # http://localhost:8787
npm test                         # vitest inside the Workers runtime
npm run typecheck                # Worker + tests (tsconfig.json), then UI JS (tsconfig.public.json)
npm run build                    # wrangler deploy --dry-run: bundles only, no account, no upload
```

Deploying needs Mattan's OK and account: `npm run deploy` and `npm run db:migrate:remote`. The secrets (`PRINTER_TOKEN`, `LOGIN_PASSWORD`, `SESSION_SECRET`) are set with `npx wrangler secret put`. The steps are in `docs/SETUP.md`.

## Layout

- `src/index.ts`: URLPattern router. `/api/*` runs here (`run_worker_first`); everything else is `public/`.
- `src/auth.ts`: signing in and the session check. `src/items.ts`, `src/printer.ts`: route handlers. `src/validate.ts`: pure input checks. `src/db.ts`: all SQL, always bound.
- `public/_headers`: the CSP and other headers for the app's files (API replies get theirs in `src/index.ts`).
- `public/`: the UI. No framework, no build step. `app.js`, `swipe.js` (swipes, and items sliding to new places) and `keyboard.js` (the iPhone keyboard) are `// @ts-check` JS; pure helpers in `lib.js` (including the swipe thresholds and spring) are unit-tested.
- `migrations/`: D1 schema. Changing it needs Mattan's OK.

## Gotchas

- **Tests share storage.** `@cloudflare/vitest-plugin` doesn't isolate storage per test, so `test/setup.ts` applies the migrations and clears the tables before every test.
- **`exports.default.fetch` in tests skips asset routing**, so the Worker passes non-API paths to `env.ASSETS` itself. Its type comes from `Cloudflare.GlobalProps.mainModule` in `src/env.d.ts`.
- **Printer routes fail closed:** no `PRINTER_TOKEN` gives `503`, a wrong one `401`. Tests set the token in `vitest.config.ts`.
- **The session check** (`src/auth.ts`) leaves `localhost` open while neither `LOGIN_PASSWORD` nor `SESSION_SECRET` is set, so local dev and most tests don't see it. Anywhere else, missing or short secrets give `503`. Tests set both on a copy of `env`; `vitest.config.ts` blanks them so `.dev.vars` can't leak in.
- **Trying the sign-in screen locally:** set both in `.dev.vars` (see `.dev.vars.example`) and use Chrome. The cookie is `Secure` with a `__Host-` name, which Chrome keeps on `http://localhost`.
- **Local D1 data is keyed by `database_id`.** Recording the real id (2026-10-12) moved local dev to a fresh, empty file: run `npm run db:migrate:local` again. The old file stays in `.wrangler/state`.
- **Phone vs laptop** is decided by `(hover: hover) and (pointer: fine)`. Phone actions are swipes; laptop actions are words on tap.
- **A delete is sent only when its undo line goes away**, or the view flips, or the page hides (`keepalive`).
- **npm 12 blocks install scripts** (workerd, esbuild). Their binaries still work; look here first if `wrangler dev` won't start.
- **Checking the UI:** `npm run dev`, then Chrome's device toolbar for phone size. Swipes are Touch Events, so use touch emulation: a mouse drag does nothing. Headless Chrome over the DevTools protocol with `Input.dispatchTouchEvent` works well (throwaway scripts, not in the repo). Chrome holds back `touchmove`s inside its ~15px slop, so test drags should move further than that.
- **The page never scrolls; `#scroller` does.** `.page` is fixed to the screen, so the keyboard can't push it up (`docs/DECISIONS.md`). Scroll positions, `scrollIntoView` and the like act on `#scroller`.
- **Focus fields with `focusInPlace()`** (`keyboard.js`), not `.focus()`, or Safari slides the page up to the field.
- **The iPhone keyboard can't be tried in Chrome.** To check the layout, fake it: redefine `visualViewport.height` (e.g. 500) and dispatch a `resize` on `visualViewport` while a field is focused. Whether Safari really stays put, and the launch strip, need a real iPhone (checks in `docs/STATUS.md`).
- **New items show before the server answers**, with an `unsaved-…` id (the `unsaved` set in `app.js`); taps and swipes ignore them until the server's copy replaces them.
- **The list isn't rebuilt while a finger is on an item** (`swipe.busy()`); `render()` waits and runs when the touch ends. Rebuild only through `render()`/`renderRow()`, and wrap changes that move items in `moveSmoothly()`.
