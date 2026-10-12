# Current status

_Last updated: 2026-10-11_

## Phase

**2: `apps/printer`, in progress** (`/build auto`, started 2026-10-11, run without questions at Mattan's request). Spec: `spec/SPEC-printer.md`; tasks: `tasks/todo.md`. Phase 1 (`apps/web`) is built and checked.

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

Continue `tasks/todo.md` (Phase 2) with `/build auto`. After that: Phase 3 (launchd install), then Phase 4 (deploy, Cloudflare Access, first real weekly run).

## Checklist: inputs and actions needed from Mattan

Collected during Phase 2 (Mattan asked for no questions until the end). Placeholders are used until these are done.

**Decisions to confirm (assumptions made)**
- [ ] Catch-up: the most recent missed Sunday prints at the next run at home; older missed weeks are skipped; a first install mid-week prints right away.
- [ ] No active items: nothing is printed or emailed that week.
- [ ] Unreachable printer: keep trying hourly, and after 24 hours email the PDF instead.
- [ ] Grouping model `claude-sonnet-5-5` (from `CLAUDE.md`), with Anthropic's automatic refusal fallback (`fallbacks: "default"`) turned on.

**Approve (added without asking)**
- [ ] Runtime package `@anthropic-ai/sdk` in `apps/printer` (the Claude skill requires the official SDK; it's the job's only runtime package).
- [ ] Dev packages `typescript`, `@types/node` in `apps/printer`.

**Inputs**
- [ ] `ANTHROPIC_API_KEY` (until then the sheet is one list, with no grouping).
- [ ] Gmail: `GMAIL_USER`, an app password `GMAIL_APP_PASSWORD` (needs 2-Step Verification), and `NOTIFY_TO` (your own address).
- [ ] Cloudflare account (Phase 4); then the real `DASHBOARD_API_URL` and `PRINTER_TOKEN`.

**Actions**
- [ ] Review the sheet's look in a dry-run PDF (`apps/printer/out/`).
- [ ] OK the first real test print, and the first real email (to your address).

## Needed from Mattan before deploying

- A Cloudflare account
- An Anthropic API key
- A Gmail app password, plus the address to notify

## Open questions

None open: print time is Sundays 09:00, and items don't expire (archived by hand). Both decided 2026-10-11.

## Notes for the next session

- Commits go to `origin`. `/build` (upstream copy) commits each finished task. The spec lives in `spec/` so `/build auto` can find it.
- Skills live in `.agents/skills/` (committed), linked from `.claude/skills/`. If they go missing: `npx skills experimental_install`.
- The UI is Mattan's to design: ask before any visual or interaction change, and record the answer in `docs/UI.md`. A private options page with the earlier choices: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- Local dev needs `apps/web/.dev.vars` (copy `.dev.vars.example`) and `npm run db:migrate:local` once. See `apps/web/CLAUDE.md` for gotchas.
