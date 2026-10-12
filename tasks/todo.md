# Tasks: `web` (Phase 1)

Spec: `spec/SPEC-web.md` · Plan: `tasks/plan.md`

All commands run from `apps/web/`. "Standard checks" below means all three of these pass:
`npm test` · `npm run typecheck` · `npm run build`

---

- [ ] **Task 1: Worker toolchain and test harness**

  **Description:** Set up the Worker so that it runs under `wrangler dev`, builds, typechecks, and has a test runner working inside the Workers runtime. The only behavior is a JSON 404 for unknown `/api/*` paths and a placeholder `index.html`. Check the current Cloudflare docs for the vitest pool config, Worker types and static-asset routing before writing config (`source-driven-development`).

  **Acceptance criteria:**
  - `package.json` has the scripts `dev`, `test`, `typecheck`, `build`, `db:migrate:local`.
  - `wrangler.jsonc` declares the Worker, a D1 binding `DB` (database `dashboard`) and an assets directory `public/`; `/api/*` reaches the Worker and `/` serves `public/index.html`.
  - `GET /api/nope` returns `404 {"error":"Not found"}` with `Content-Type: application/json`.

  **Verification:**
  - [ ] Standard checks pass (one test: unknown `/api` route → 404 JSON; one test: `/` → 200 HTML)
  - [ ] Manual: `npm run dev`, then `curl -i localhost:8787/api/nope` and open `localhost:8787` in the browser

  **Dependencies:** None

  **Files likely touched:** `apps/web/package.json`, `apps/web/wrangler.jsonc`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/src/index.ts`, `apps/web/src/http.ts`, `apps/web/public/index.html`, `apps/web/test/index.test.ts`, `apps/web/.dev.vars.example`, root `.gitignore` (add `.dev.vars`)

  **Estimated scope:** M (many files, but most are short config)

---

- [ ] **Task 2: D1 schema applied in tests and locally**

  **Description:** Add `migrations/0001_init.sql` exactly as in the spec's data model (`items`, `print_runs`, the index and the `CHECK` constraints). Apply the migrations automatically before tests, and locally with `npm run db:migrate:local`.

  **Acceptance criteria:**
  - Tests see both tables with the spec's columns.
  - The `CHECK` constraints reject `pinned = 2` and an unknown `print_runs.status`.
  - `npm run db:migrate:local` applies cleanly to a fresh `.wrangler` state.

  **Verification:**
  - [ ] Standard checks pass (new `test/schema.test.ts`)
  - [ ] Manual: `rm -rf .wrangler && npm run db:migrate:local`

  **Dependencies:** Task 1

  **Files likely touched:** `apps/web/migrations/0001_init.sql`, `apps/web/vitest.config.ts`, `apps/web/test/apply-migrations.ts` (or the setup the docs recommend), `apps/web/test/schema.test.ts`

  **Estimated scope:** S

---

- [ ] **Task 3: API: create and list items**

  **Description:** `POST /api/items` and `GET /api/items?status=active|archived`, with the spec's validation, item shape and ordering. This adds the router's `405` and `415` handling and the catch-all `500` that logs server-side and returns a generic message.

  **Acceptance criteria:**
  - Create validates `text` (trimmed, 1–500 chars, newlines kept), `category` (trimmed, empty → null, ≤ 40), `pinned` (boolean), rejects unknown fields, and returns `201 { item }` in the spec's camelCase shape.
  - The list returns active items pinned first, then newest first. `status=archived` returns archived items, most recently archived first. Any other `status` → `400`.
  - Non-JSON content type → `415`, wrong method → `405`, malformed JSON → `400`.

  **Verification:**
  - [ ] Standard checks pass (`test/items.test.ts`, `test/validate.test.ts`, including text with `<b>`, quotes, emoji and newlines round-tripping exactly)
  - [ ] Manual: `curl` a create and a list against `npm run dev`

  **Dependencies:** Task 2

  **Files likely touched:** `apps/web/src/validate.ts`, `apps/web/src/db.ts`, `apps/web/src/items.ts`, `apps/web/src/index.ts`, `apps/web/test/items.test.ts`, `apps/web/test/validate.test.ts`

  **Estimated scope:** M

---

- [ ] **Task 4: UI: add and list items**

  **Description:** The first real screen: a heading, the add form (text area plus optional category field and Add button) and the active list. Enter saves and Shift+Enter adds a newline. The new item appears without a reload, and the field clears and keeps focus. On failure the text stays and an error shows. Item text is rendered with `textContent` only. Base styles: system font, 16px+ inputs, 44px tap targets, light and dark mode, plus the empty state "Nothing here yet."

  **Acceptance criteria:**
  - At a phone-size viewport, tap field → type → Enter adds the item, and it shows at the right place in the list.
  - `<b>hi</b>` as item text shows literally.
  - `public/app.js` is `// @ts-check` and passes `npm run typecheck`.

  **Verification:**
  - [ ] Standard checks pass
  - [ ] Manual (`browser-testing-with-devtools`): Chrome at a phone viewport against `npm run dev`. Add an item; reload and it's still there; no console errors; empty state shows on a fresh database.

  **Dependencies:** Task 3

  **Files likely touched:** `apps/web/public/index.html`, `apps/web/public/app.js`, `apps/web/public/style.css`, `apps/web/tsconfig.json`

  **Estimated scope:** M

---

### Checkpoint A: after Tasks 1–4
- [ ] Standard checks pass
- [ ] Adding an item from a phone-size viewport works end to end (spec success criterion 3)
- [ ] Review with Mattan before continuing

---

- [ ] **Task 5: API: edit, pin, archive and restore (`PATCH /api/items/:id`)**

  **Description:** Partial updates for `text`, `category`, `pinned` and `archived`, with the same validation as create. `archived: true` sets `archived_at` to now and `archived: false` clears it. Every change bumps `updated_at`.

  **Acceptance criteria:**
  - Each field updates alone and in combination. Unknown id → `404`; empty body or unknown field → `400`.
  - Archive moves the item from the active list to the archived list; restore moves it back.
  - Pinning puts the item at the top of the active list.

  **Verification:**
  - [ ] Standard checks pass (extended `test/items.test.ts`, `test/validate.test.ts`)

  **Dependencies:** Task 3

  **Files likely touched:** `apps/web/src/validate.ts`, `apps/web/src/db.ts`, `apps/web/src/items.ts`, `apps/web/test/items.test.ts`, `apps/web/test/validate.test.ts`

  **Estimated scope:** M

---

- [ ] **Task 6: UI: edit in place, pin, archive with undo**

  **Description:** Tapping an item opens it for editing in place, with text, category, Pin/Unpin, Archive, Save and Cancel. Archive removes the item and shows an "Archived · Undo" toast for about 5 seconds; Undo restores it.

  **Acceptance criteria:**
  - Edits, pin/unpin and archive persist across a page reload.
  - Undo within the toast window brings the item back in its correct position.
  - Editing is keyboard-usable (Escape cancels) and has visible focus.

  **Verification:**
  - [ ] Standard checks pass
  - [ ] Manual at a phone viewport: edit text, change category, pin, unpin, archive, undo, archive without undo, then reload and check each result.

  **Dependencies:** Tasks 4, 5

  **Files likely touched:** `apps/web/public/app.js`, `apps/web/public/style.css`, `apps/web/public/index.html`

  **Estimated scope:** S

---

- [ ] **Task 7: Delete and the archived view**

  **Description:** `DELETE /api/items/:id` (`204`, or `404` for an unknown id). In the UI, an "Active · Archived (n)" switch. The archived view lists archived items with Restore and Delete; Delete asks for confirmation inside the page, never with a browser `confirm()`.

  **Acceptance criteria:**
  - Delete removes the row from the database. A second delete returns `404`.
  - Restore moves an item back to the active view.
  - The archived count is correct after archive, restore and delete.

  **Verification:**
  - [ ] Standard checks pass (delete tests in `test/items.test.ts`)
  - [ ] Manual at a phone viewport: switch views, restore, delete (confirm and cancel), reload.

  **Dependencies:** Tasks 5, 6

  **Files likely touched:** `apps/web/src/db.ts`, `apps/web/src/items.ts`, `apps/web/test/items.test.ts`, `apps/web/public/app.js`, `apps/web/public/index.html`

  **Estimated scope:** M

---

- [ ] **Task 8: Category suggestions**

  **Description:** `GET /api/categories` returns the distinct categories of active items, A–Z. The category inputs (add form and edit) offer them through a `<datalist>`.

  **Acceptance criteria:**
  - The list has no nulls or duplicates, and categories of archived items aren't included.
  - A category added in the UI is suggested in the next add without a reload.

  **Verification:**
  - [ ] Standard checks pass
  - [ ] Manual: add two items with categories; the suggestion list shows both.

  **Dependencies:** Task 4

  **Files likely touched:** `apps/web/src/db.ts`, `apps/web/src/items.ts`, `apps/web/test/items.test.ts`, `apps/web/public/app.js`, `apps/web/public/index.html`

  **Estimated scope:** M

---

### Checkpoint B: after Tasks 5–8
- [ ] Standard checks pass
- [ ] Every UI story (spec user stories 1–6) works and persists across reload (spec success criteria 4–6)
- [ ] Review with Mattan before continuing

---

- [ ] **Task 9: Printer routes with bearer token**

  **Description:** `GET /api/printer/items` (active items, same shape and order) and `POST /api/printer/runs` (`{ week, status, printedAt?, emailedAt? }`). Both require `Authorization: Bearer <PRINTER_TOKEN>`, compared in constant time. If no token is configured, they return `503`, never open access. The UI routes don't accept the token, and the printer routes don't serve anything without it.

  **Acceptance criteria:**
  - Missing or wrong token → `401`; token not configured → `503`; right token → `200`/`201`.
  - `week` must match `YYYY-Www`, `status` must be one of `printed`, `emailed_only`, `failed`, and the timestamps must be ISO strings. Anything else → `400`.
  - The archived items never appear in `GET /api/printer/items`.

  **Verification:**
  - [ ] Standard checks pass (`test/printer.test.ts`)
  - [ ] Manual: the `curl` from spec success criterion 7, with and without the token from `.dev.vars`

  **Dependencies:** Task 3

  **Files likely touched:** `apps/web/src/printer.ts`, `apps/web/src/index.ts`, `apps/web/src/validate.ts`, `apps/web/src/db.ts`, `apps/web/test/printer.test.ts`

  **Estimated scope:** M

---

- [ ] **Task 10: Home-screen app, accessibility and safe-text pass**

  **Description:** Add `manifest.webmanifest` (name "Dashboard", `display: standalone`), an SVG icon and a PNG `apple-touch-icon` (rendered once with the installed headless Chrome), and the matching `<head>` tags. Then a pass over the whole UI: labels, real buttons, focus order, contrast in light and dark mode, and a final check that no user text ever goes through `innerHTML`.

  **Acceptance criteria:**
  - Chrome DevTools shows a valid manifest with an icon.
  - Every control has an accessible name and is reachable by keyboard.
  - `grep innerHTML public/` finds nothing that touches user data.

  **Verification:**
  - [ ] Standard checks pass
  - [ ] Manual: DevTools Application → Manifest; keyboard-only run through add, edit, archive, undo; dark mode screenshot at a phone viewport

  **Dependencies:** Tasks 4–8

  **Files likely touched:** `apps/web/public/manifest.webmanifest`, `apps/web/public/icon.svg`, `apps/web/public/apple-touch-icon.png`, `apps/web/public/index.html`, `apps/web/public/style.css`

  **Estimated scope:** M

---

- [ ] **Task 11: Docs and final check against the spec**

  **Description:** Write `apps/web/CLAUDE.md` (commands and gotchas) and add the commands to the root `CLAUDE.md`. Update `docs/ARCHITECTURE.md` (`wrangler.jsonc`, `GET /api/categories`, `print_runs.created_at`) and add the Phase 1 entries to `docs/DECISIONS.md` (no UI framework, no router library, Workers-runtime tests, `wrangler.jsonc`). Then walk through spec success criteria 1–9 from a clean state.

  **Acceptance criteria:**
  - From `rm -rf node_modules .wrangler`: `npm install && npm run db:migrate:local && npm run dev` gives a working app.
  - Every spec success criterion is checked off, with any gap written down in `docs/STATUS.md`.
  - The docs describe what was actually built.

  **Verification:**
  - [ ] Standard checks pass
  - [ ] Manual: the clean-state run above, plus a final run through all UI stories at a phone viewport

  **Dependencies:** Tasks 1–10

  **Files likely touched:** `apps/web/CLAUDE.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`

  **Estimated scope:** M

---

### Checkpoint C: Phase 1 complete
- [ ] Standard checks pass
- [ ] All spec success criteria met
- [ ] Review with Mattan before Phase 2 (`apps/printer`)
