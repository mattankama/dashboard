# Spec: `web` (Phase 1: Worker + D1 + phone UI)

_Status: **approved 2026-10-11.** Mattan left the open questions to Claude; the answers are under Resolved Questions._

Module id: `web`. It is the provider side of the printer↔web contract; `printer` (Phase 2) depends on it.

## Objective

Build the place where items live and the quickest possible way to add them from a phone.

**User:** Mattan, on their phone (mostly) or a laptop browser. Single user.

**User stories**

1. When something comes to mind, I open Dashboard on my phone, type it, hit Enter, and it's saved. A few seconds, total.
2. I can see all my active items, with pinned ones at the top.
3. I can pin or unpin an item, so it prints first.
4. I can fix a typo.
5. After reading the weekly sheet, I archive what's no longer relevant. If I archive by mistake, I can undo it.
6. I can look at archived items, restore one, or delete it for good.
7. *(For Phase 2)* The Mac job can fetch active items and record a print run with a bearer token.

**Phase 1 is local only.** Everything runs under `wrangler dev` with local D1. Deploying, Cloudflare Access and the Access JWT check are Phase 4.

## Assumptions (correct any of these)

1. **No UI framework, no build step for the UI.** The UI is static files (`index.html`, `app.js`, `style.css`) served by Workers Static Assets. `app.js` is plain JS with `// @ts-check` and JSDoc types, so `tsc` still checks it. One screen, a few hundred lines; a framework would be the biggest moving part in the app.
2. **No router library.** About six routes, matched by hand in the Worker. No Hono.
3. **Printer routes are built in Phase 1**, because they pin down the contract Phase 2 needs and are easy to test locally.
4. **Both tables are created in the first migration** (`items` and `print_runs`), so the schema doesn't change again in Phase 2.
5. **No categories in the UI** (Mattan's call; see `docs/UI.md`). The API keeps the data model's optional `category` field, unused by the UI, so the printed sheet's fallback is one list.
6. **Archiving is manual.** No automatic expiry. If expiry is wanted later, it can be computed from `created_at` with no schema change.
7. **PWA = add-to-home-screen only**: a web manifest and an icon. No service worker and no offline capture in Phase 1.
8. **Hard delete is only offered for archived items** in the UI. The API allows it on any item.
9. **`apps/web` is a standalone npm package** (its own `package.json`), not an npm workspace.
10. **`wrangler.jsonc`** instead of `wrangler.toml` (Cloudflare's current recommendation for new projects). `docs/ARCHITECTURE.md` gets updated to match.

## Tech Stack

| What | Choice | Version (2026-10-11) |
|---|---|---|
| Runtime | Cloudflare Workers, Static Assets | — |
| Database | D1 (SQLite), local via Miniflare | — |
| Language | TypeScript (Worker), `@ts-check` JS (UI) | `typescript` 7.0.x |
| Node | v24 via nvm | 24.16.0 |

**New dev dependencies (need approval):**

| Package | Why |
|---|---|
| `wrangler` 4.x | Local dev, D1 migrations, later deploy. Pinned in `package.json` instead of ad-hoc `npx`, so every run uses the same version. |
| `typescript` 7.x | Typecheck the Worker and the UI script. |
| `@cloudflare/workers-types` | Types for `D1Database`, `Request`, etc. (or `wrangler types`-generated types, if the docs now recommend that instead; checked at implementation time) |
| `vitest` 4.1.x + `@cloudflare/vitest-plugin` 1.4.x | Runs tests inside the real Workers runtime against local D1. (Replaced the deprecated `@cloudflare/vitest-pool-workers`, its renamed successor.) |

No runtime dependencies.

## Data model

Migration `migrations/0001_init.sql`, matching `docs/ARCHITECTURE.md`:

```sql
CREATE TABLE items (
  id          TEXT PRIMARY KEY,              -- crypto.randomUUID()
  text        TEXT NOT NULL,
  category    TEXT,                          -- null = uncategorized
  pinned      INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at  TEXT NOT NULL,                 -- ISO 8601 UTC
  updated_at  TEXT NOT NULL,
  archived_at TEXT                           -- null = active
);
CREATE INDEX items_archived_at ON items (archived_at);

CREATE TABLE print_runs (
  id          TEXT PRIMARY KEY,
  week        TEXT NOT NULL,                 -- ISO week, e.g. 2026-W41
  printed_at  TEXT,
  emailed_at  TEXT,
  status      TEXT NOT NULL CHECK (status IN ('printed', 'emailed_only', 'failed')),
  created_at  TEXT NOT NULL
);
```

(`print_runs.created_at` is new compared to the architecture doc, so a failed run with no timestamps still has a time.)

## API

All bodies are JSON. Mutating requests must send `Content-Type: application/json` (otherwise `415`), which also blocks simple cross-site form posts. Errors are `{ "error": "<message>" }`.

**Item shape** returned everywhere:

```json
{ "id": "…", "text": "…", "category": "School", "pinned": true,
  "createdAt": "…", "updatedAt": "…", "archivedAt": null }
```

### UI routes (Cloudflare Access in Phase 4; open under `wrangler dev`)

| Route | Body | Success | Errors |
|---|---|---|---|
| `GET /api/items?status=active\|archived` | — | `200 { items }`; default `active` | `400` bad status |
| `POST /api/items` | `{ text, category?, pinned? }` | `201 { item }` | `400` validation |
| `PATCH /api/items/:id` | `{ text?, category?, pinned?, archived? }` | `200 { item }` | `400`, `404` |
| `DELETE /api/items/:id` | — | `204` | `404` |

**Ordering:** active items are pinned first, then newest first. Archived items are most recently archived first.

**Validation**

- `text`: required on create; trimmed; 1–500 characters after trimming; internal newlines kept. Never changed in any other way.
- `category`: trimmed; empty string or `null` means none; at most 40 characters.
- `pinned`, `archived`: booleans only.
- `PATCH` with no known fields → `400`. Unknown fields → `400` (catches typos early).
- `archived: true` sets `archived_at` to now; `archived: false` clears it. Any change updates `updated_at`.

### Printer routes (bearer token)

Require `Authorization: Bearer <PRINTER_TOKEN>`, compared in constant time. Missing or wrong token → `401`. If `PRINTER_TOKEN` isn't configured, these routes return `503`, never open access. Locally the token comes from `apps/web/.dev.vars` (git-ignored).

| Route | Body | Success |
|---|---|---|
| `GET /api/printer/items` | — | `200 { items }`, active only, same shape and order as above |
| `POST /api/printer/runs` | `{ week, status, printedAt?, emailedAt? }` | `201 { run }` |

The UI routes do **not** accept the printer token, and the printer routes don't accept the UI session. Each side gets only what it needs.

### Everything else

- Unknown `/api/*` → `404` JSON. Wrong method on a known route → `405`.
- Any other path → static assets (`index.html` at `/`).
- Unexpected errors → `500 { error: "Internal error" }`, with the detail logged via `console.error` (never sent to the client).

## UI

One screen, phone-first, also fine on a laptop. **Look and interaction follow `docs/UI.md`.** That file wins over this section, and Mattan is asked about anything it leaves open.

```
┌──────────────────────┐
│ Dashboard            │
│ ★ Call Grandma       │  ← pinned first
│ · Read Thinking in…  │
│ · Ask about summer…  │
│                      │
├──────────────────────┤
│ Keep in mind…      ↵ │  ← add field, always at the bottom
└──────────────────────┘
```

- **Add:** a field at the bottom; return saves. The new item appears without a reload, and the field clears and keeps focus. On failure the text stays and an error shows.
- **Each item:** text exactly as written (newlines kept). Tap to edit in place (text, pin, archive). Swipe left to archive.
- **Archive:** the item leaves the list, and an undo toast shows for about 5 seconds.
- **Archived view:** restore, or delete with an in-page confirmation (never a browser `confirm()`).
- **Empty state:** one quiet line.
- **Basics:** inputs 16px+ (avoids iOS zoom), tap targets ≥ 44px, dark theme only.
- **Accessible:** real `<button>`s and `<label>`s, keyboard usable, visible focus. Every swipe action is also reachable without swiping.
- **Safe rendering:** item text goes on the page with `textContent`, never `innerHTML`.
- **Home screen:** `manifest.webmanifest` with name "Dashboard", `display: standalone` and an icon.

## Commands

All run from `apps/web/`:

```
npm install                 # once
npm run db:migrate:local    # wrangler d1 migrations apply dashboard --local
npm run dev                 # wrangler dev  → http://localhost:8787
npm test                    # vitest run (Workers pool, local D1)
npm run typecheck           # tsc --noEmit (Worker + public/app.js)
npm run build               # wrangler deploy --dry-run --outdir .wrangler/dist (bundles only; no account, no upload)
```

(`deploy` and `db:migrate:remote` are added in Phase 4, not now.)

## Project Structure

```
apps/web/
  CLAUDE.md               commands and gotchas for this app
  package.json
  package-lock.json
  tsconfig.json
  vitest.config.ts
  wrangler.jsonc          Worker name, D1 binding "DB", assets dir
  .dev.vars.example       PRINTER_TOKEN=dev-token   (.dev.vars itself is git-ignored)
  migrations/
    0001_init.sql
  src/
    index.ts              fetch handler: route /api/*, otherwise assets
    http.ts               json(), error helpers, readJson()
    items.ts              UI item routes
    printer.ts            printer routes + bearer check
    db.ts                 all SQL; row ↔ Item mapping
    validate.ts           input validation (pure functions)
  public/
    index.html
    app.js                // @ts-check, no framework
    style.css
    manifest.webmanifest
    icon.svg (+ PNG for iOS)
  test/
    items.test.ts         route tests against local D1
    printer.test.ts
    validate.test.ts
```

`.gitignore` gains `.dev.vars`.

## Code Style

- Small, plain functions. SQL lives only in `db.ts`, always with bound parameters (`.bind()`), never string-built.
- Validation returns a result instead of throwing, so routes stay flat.
- camelCase in TypeScript and JSON, snake_case in SQL; `db.ts` maps between them.
- Comments only where the *why* isn't obvious.

```ts
// src/items.ts
export async function createItem(req: Request, env: Env): Promise<Response> {
  const body = await readJson(req);
  if (!body.ok) return error(body.status, body.message);

  const input = validateNewItem(body.value);
  if (!input.ok) return error(400, input.message);

  const item = await insertItem(env.DB, input.value);
  return json({ item }, 201);
}
```

## Testing Strategy

- **Framework:** vitest with `@cloudflare/vitest-plugin`, so tests run in the Workers runtime against a real local D1 that's migrated before each test file and isolated per test.
- **Route tests** (`test/items.test.ts`, `test/printer.test.ts`) call the Worker's `fetch` and check status codes, bodies, and the database afterwards. They cover each route's happy path, every validation rule, `404`/`405`/`415`, ordering, archive/restore, and the printer token cases (missing, wrong, right, not configured).
- **Pure unit tests** (`test/validate.test.ts`) for the validation edge cases (whitespace, length limits, unknown fields, wrong types).
- **Test-first** for the Worker (`test-driven-development`): write the failing route test, then the code.
- **UI:** checked by hand in Chrome at a phone viewport (`browser-testing-with-devtools`) against `npm run dev`: add, edit, pin, archive + undo, restore, delete, empty state, and a check that `<b>hi</b>` as item text shows literally. No UI test framework in Phase 1.
- **Typecheck** must pass, including `public/app.js`.
- No coverage percentage target; every route and validation rule has at least one test.

## Boundaries

- **Always:** run `npm test` and `npm run typecheck` before calling a task done. Use bound SQL parameters. Render user text with `textContent`. Keep item text exactly as entered (trim only). Log unexpected errors server-side.
- **Ask first:** installing the dev dependencies above; any schema change after `0001_init.sql` is applied; any runtime dependency; anything touching a real Cloudflare account (login, deploy, remote D1); committing.
- **Never:** commit `.dev.vars`, `.env` or tokens. Let the printer token unlock UI routes or vice versa. Treat a missing `PRINTER_TOKEN` as "allow". Add AI features to the web app (grouping happens in the printer job).

## Success Criteria

Phase 1 is done when all of these are true:

1. `npm install && npm run db:migrate:local && npm run dev` from a clean checkout gives a working app at `http://localhost:8787`.
2. `npm test` and `npm run typecheck` pass.
3. In a phone-size Chrome viewport, an item can be added with: tap the field, type, press Enter. No other required taps, and it shows in the list without a reload.
4. Edit, pin/unpin, archive with undo, restore, and delete all work in the UI and persist across a page reload.
5. Pinned items list first; the rest newest first.
6. Text containing HTML, quotes, emoji and newlines is stored and shown exactly as typed.
7. `curl -H "Authorization: Bearer <token from .dev.vars>" localhost:8787/api/printer/items` returns only active items; without the token it returns `401`. `POST /api/printer/runs` stores a run.
8. `apps/web/CLAUDE.md` exists, and the root `CLAUDE.md` lists the new commands.
9. `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` reflect anything that changed (`wrangler.jsonc`, `print_runs.created_at`, no UI framework).

## Out of Scope for Phase 1

Deploying, Cloudflare Access and the Access JWT check, custom domain, offline capture / service worker, search, sorting options, bulk actions, import/export, and anything from the printer job.

## Resolved Questions

1. **Categories:** none in the UI. Mattan decided this while choosing the look (`docs/UI.md`); the API keeps the optional field.
2. **Item length limit:** 500 characters. These are short notes to keep in mind, and the sheet has to fit on one or two pages. Raising the limit later is a one-line change.
3. **Print day/time and expiry** don't affect Phase 1. They're decided in Phase 2 (default Sunday 09:00, archive by hand).
