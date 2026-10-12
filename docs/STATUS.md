# Current status

_Last updated: 2026-10-11_

## Phase

**2: `apps/printer` is built** (`/build auto`, 2026-10-11, without questions at Mattan's request). Every success criterion in `spec/SPEC-printer.md` was checked, including from a fresh clone. It has only ever run as `--dry-run`: **nothing has been printed or emailed.** Phase 1 (`apps/web`) is built and checked. Everything is pushed to `github.com/mattankama/dashboard` (private, `main`).

## Done

- Product context, architecture, print layout and decision log (`docs/`); UI decisions (`docs/UI.md`, all Mattan's).
- **Phase 1, `apps/web`** (`tasks/archive/phase1-todo.md`): Worker + D1, the item API, printer routes behind a token, and the phone UI. 83 tests.
- **Phase 2, `apps/printer`** (`tasks/todo.md`, Tasks 1–10):
  - the weekly run: Sunday 09:00, catch-up, retry hourly, email-only after 24h, a lock, once-a-week alerts;
  - Claude grouping, checked, with a fallback;
  - the sheet per `docs/PRINT_LAYOUT.md`, made into a PDF by Chrome and fitted to one page;
  - `lp` printing with stuck-job cancel; `curl` email; macOS notification as the last resort;
  - `npm run dry-run` and `--sample` previews.
  - 111 tests: fakes everywhere, plus real Chrome and real `curl` against a local fake SMTP server.

## Next task

**Phase 3: launchd.** Write `apps/printer/launchd/org.dashboard.weekly.plist` (`StartInterval` 3600, running `npm run weekly` or `node src/weekly.ts`) and `install.sh`. Have install mark the current week done, so a mid-week install doesn't print at once. Loading it needs Mattan's OK. Optional: `sudo pmset repeat wakeorpoweron Su 08:55:00`, also with Mattan's OK.

After that, Phase 4: deploy the Worker, then Cloudflare Access (plus the Access JWT check), then the first real weekly run.

## Checklist: inputs and actions needed from Mattan

Mattan asked for Phase 2 without questions. Everything decided along the way is here to confirm, and the job uses placeholders until the inputs arrive.

**Decisions to confirm (assumptions made)**
- [ ] **Catch-up:** the job handles the most recent Sunday 09:00 that has passed, so a missed Sunday prints at the next run at home and older missed weeks are skipped. (A mid-week first install would print at once; Phase 3's install will pre-mark the week.)
- [ ] **No active items:** nothing is printed or emailed that week.
- [ ] **Unreachable printer:** retry every hour; after 24 hours, email the PDF instead. A print job stuck for 5 minutes is cancelled, so it can't print twice.
- [ ] **Alerts:** lasting problems (missing settings, the API down, Chrome failing) show a macOS notification once a week, not every hour.
- [ ] **Grouping:** `claude-sonnet-5-5` (from `CLAUDE.md`) at effort `high`, with Anthropic's automatic refusal fallback (`fallbacks: "default"`) turned on.
- [ ] **The sheet's look:** follows `docs/PRINT_LAYOUT.md`; the rest is my choice ("Dashboard" on the left with the date range on the right, ★ for pinned items, • for others, the small footer). Review `apps/printer/out/weekly-2026-10-11.pdf`, or make a new one with `npm run dry-run -- --sample`.

**Approve (added without asking; `CLAUDE.md` says to ask first)**
- [ ] Runtime package `@anthropic-ai/sdk` 0.133.0 in `apps/printer`: the Claude skill requires the official SDK, and it's the job's only runtime package.
- [ ] Dev-only packages `typescript` 7.0.2 and `@types/node` 24.19.2 in `apps/printer`.

**Inputs** (go in `apps/printer/.env`, which is git-ignored: `cp .env.example .env`)
- [ ] `ANTHROPIC_API_KEY`. Until then the sheet is one plain list.
- [ ] `GMAIL_USER` and `GMAIL_APP_PASSWORD`: an app password, which needs 2-Step Verification on the account.
- [ ] `NOTIFY_TO`: your own single address. Email only ever goes there.
- [ ] Cloudflare account (Phase 4); then the real `DASHBOARD_API_URL`, and a real `PRINTER_TOKEN` set with `wrangler secret` and in `.env`.

**Actions**
- [ ] With a key in `.env`, run `npm run dry-run` once to see Claude's grouping (one small API call).
- [ ] OK the first real print and email: `npm run weekly -- --force` prints on the Canon and emails `NOTIFY_TO` right away.
- [ ] Allow notifications for Script Editor (`osascript`) when macOS asks, or in System Settings → Notifications; otherwise the last-resort alerts won't show.
- [ ] Phase 3: OK loading the launchd job, and optionally the `pmset` wake schedule (`sudo`).

## Open questions

None open. Print time is Sundays 09:00, and items don't expire (archived by hand); both decided 2026-10-11. Assumptions to confirm are in the checklist above.

## Notes for the next session

- Commits go to `origin`. `/build` (upstream copy) commits each finished task. Specs live in `spec/` (`SPEC-web.md`, `SPEC-printer.md`) so `/build auto` can find them; finished task lists move to `tasks/archive/`.
- Skills live in `.agents/skills/` (committed), linked from `.claude/skills/`. If they go missing: `npx skills experimental_install`.
- The UI is Mattan's to design: ask before any visual or interaction change, and record the answer in `docs/UI.md`. A private options page with the earlier choices: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- Local dev needs `apps/web/.dev.vars` (copy `.dev.vars.example`) and `npm run db:migrate:local` once. See `apps/web/CLAUDE.md` for gotchas.
- `apps/printer` dry runs read `apps/printer/.env` (copy `.env.example`); its placeholders point at the local web app. See `apps/printer/CLAUDE.md`.
