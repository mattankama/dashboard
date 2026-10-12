# Current status

_Last updated: 2026-10-11_

## Phase

**1: `apps/web` is built** and runs locally. All spec success criteria (`spec/SPEC-web.md`) were checked on 2026-10-11, including from a fresh clone. Nothing is deployed. Everything is committed and pushed to `github.com/mattankama/dashboard` (private, `main`).

## Done

- Product context, architecture, print layout and decision log (`docs/`); UI decisions (`docs/UI.md`, all Mattan's).
- Phase 1 (`tasks/todo.md`, Tasks 1–11; Task 8 dropped because there are no categories in the UI):
  - Worker + D1 (`items`, `print_runs`) with the item API (create, list, edit, pin, archive, restore, delete).
  - Printer routes behind a bearer token, ready for Phase 2.
  - The phone UI: a dot-grid journal page with today's date. Add at the bottom. On the phone, actions are swipes; on a laptop, they're words on tap. The archive opens by tapping the date. Undo lines cover archive, restore and delete.
  - Home-screen icon and manifest; a keyboard and accessibility pass.
  - 83 tests (Workers runtime, local D1), with type checking for the Worker and the UI's JS.
- Printer confirmed reachable from this Mac (CUPS queue `CanonMF4800`, AirPrint). No test page printed yet.

## Next task

**Phase 2: `apps/printer` with `--dry-run`.** Start with `spec-driven-development` for `spec/SPEC-printer.md`, then planning. It fetches from `GET /api/printer/items` and reports to `POST /api/printer/runs` (token in `.env`). Decide the open questions below while specifying.

After that:
- Phase 3: launchd install.
- Phase 4: deploy, then Cloudflare Access (including the Access JWT check in the Worker), then the first real weekly run.

## Needed from Mattan before deploying

- A Cloudflare account
- An Anthropic API key
- A Gmail app password, plus the address to notify

## Open questions (for Phase 2)

- Print day and time (default: Sunday 09:00).
- Do items expire after N weeks, or does Mattan archive them by hand? (Phase 1 is archive-by-hand; expiry needs no schema change.)

## Notes for the next session

- Commits go to `origin`. `/build` (upstream copy) commits each finished task. The spec lives in `spec/` so `/build auto` can find it.
- Skills live in `.agents/skills/` (committed), linked from `.claude/skills/`. If they go missing: `npx skills experimental_install`.
- The UI is Mattan's to design: ask before any visual or interaction change, and record the answer in `docs/UI.md`. A private options page with the earlier choices: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- Local dev needs `apps/web/.dev.vars` (copy `.dev.vars.example`) and `npm run db:migrate:local` once. See `apps/web/CLAUDE.md` for gotchas.
