# Implementation Plan: `web` (Phase 1)

Spec: [`spec/SPEC-web.md`](../spec/SPEC-web.md). Tasks with acceptance criteria: [`todo.md`](todo.md).

## Overview

Build `apps/web` locally: a Cloudflare Worker with a D1 database, a JSON API for items, the printer routes for Phase 2, and a single-screen phone UI. Everything runs under `wrangler dev`. Nothing is deployed and no Cloudflare account is touched.

The order is: tooling and schema first, then **adding and listing items, end to end through the UI**, as early as possible. Then the remaining item actions, one vertical slice at a time, then the printer contract, then polish and docs.

## Architecture Decisions

All of these come from the approved spec; they're repeated here because they shape the tasks.

- **Plain Worker, hand-written router.** `src/index.ts` sends `/api/*` to handlers and everything else to static assets. No Hono.
- **Static UI with no build step.** `public/app.js` is `// @ts-check` JS, checked by `tsc` along with the Worker.
- **All SQL lives in `src/db.ts`**, always with bound parameters. Validation in `src/validate.ts` is pure functions returning `{ ok, value | message }`.
- **Tests run in the Workers runtime** (`@cloudflare/vitest-pool-workers`) against local D1, with migrations applied before tests.
- **`npm run build` is `wrangler deploy --dry-run`**, which bundles the Worker without an account. Upstream `/build` runs the build after every task, and this gives it a real compile check.
- **Item text is stored trimmed and otherwise untouched,** and rendered only with `textContent`.

## Dependency Graph

```
T1 toolchain ──▶ T2 schema ──▶ T3 create+list API ──▶ T4 UI: add+list
                                      │
                                      ├──▶ T5 PATCH API ──▶ T6 UI: edit/pin/archive+undo
                                      │          │
                                      │          └──▶ T7 DELETE + archived view
                                      ├──▶ T8 categories + suggestions   (needs T4)
                                      └──▶ T9 printer routes
T4 … T9 ──▶ T10 PWA + polish ──▶ T11 docs + final check
```

## Task List (index)

| # | Task | Size | Depends on |
|---|---|---|---|
| 1 | Worker toolchain and test harness | M | — |
| 2 | D1 schema (`0001_init.sql`) applied in tests and locally | S | 1 |
| 3 | API: create and list items | M | 2 |
| 4 | UI: add and list items | M | 3 |
| — | **Checkpoint A:** add an item from a phone-size viewport | | |
| 5 | API: edit, pin, archive and restore (`PATCH`) | M | 3 |
| 6 | UI: edit in place, pin, archive with undo | S | 4, 5 |
| 7 | Delete and the archived view (API + UI) | M | 5, 6 |
| 8 | Category suggestions (API + UI) | M | 4 |
| — | **Checkpoint B:** every UI story works and persists across reload | | |
| 9 | Printer routes with bearer token | M | 3 |
| 10 | Home-screen app, accessibility and safe-text pass | M | 4–8 |
| 11 | Docs and final check against the spec's success criteria | M | 1–10 |
| — | **Checkpoint C:** Phase 1 complete, review with Mattan | | |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `@cloudflare/vitest-pool-workers` 0.23 with vitest 4 may configure differently from what I remember (D1 migrations in tests, config entry point) | High: blocks all tests | Task 1 is test setup only. Use `source-driven-development` and follow the current Cloudflare docs, not memory. |
| TypeScript 7 (the new native compiler) may handle JSDoc in `.js` files differently | Med: `app.js` typecheck could fail or be weaker | Checked in Task 4. Fallback: pin `typescript` to the last 6.x for checking JS. That's a dependency change, so ask Mattan first. |
| Worker vs static-asset routing: `/api/*` must reach the Worker and everything else the assets | Med | Settled in Task 1 from the docs (`assets` config with an `ASSETS` binding or `run_worker_first`), with a test for each side. |
| npm 12 blocked the install scripts for `workerd` and `esbuild` | Low | Both binaries were confirmed to run. If `wrangler dev` or tests fail on a binary, look here first. |
| On a phone keyboard, Enter submits, so there's no way to type a newline on a phone | Low | Accepted by the spec (Shift+Enter on a hardware keyboard). Revisit if Mattan misses it. |
| An iOS home-screen icon needs a PNG, and there's no image tool installed | Low | Render the SVG to PNG once with the installed headless Chrome and commit the PNG (Task 10). |

## Parallelization

One agent, one session at a time, so the tasks run in order. After Task 3, Tasks 5, 8 and 9 don't depend on each other and could be reordered if a priority changes.

## Open Questions

1. **A baseline commit before `/build`.** The repo has no commits, and upstream `/build` commits after every task (and `/build auto` stops if anything outside the spec and plan is uncommitted). I suggest one first commit of the setup: `CLAUDE.md`, `docs/`, `spec/`, `tasks/`, `.claude/`, `.gitignore`, `skills-lock.json`, and `apps/web/package.json` + `package-lock.json`. That needs Mattan's OK.
2. **`.agents/` in git?** Committing the skills means they can't silently vanish again. Ignoring the folder keeps the repo small, and `npx skills experimental_install` restores it from `skills-lock.json`. I lean toward committing it.
