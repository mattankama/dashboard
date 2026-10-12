# Current status

_Last updated: 2026-10-12_

## Phase

**Everything that can be built without Mattan's accounts is built.** Phases 1–3 are done, and Phase 4 is prepared. What's left are Mattan's steps in **`docs/SETUP.md`**: accounts, keys, deploy, Access, and loading the hourly job. Nothing has been deployed, printed, emailed or loaded into launchd. Everything is pushed to `github.com/mattankama/dashboard` (private, `main`).

## Done

- Product context, architecture, print layout and decision log (`docs/`); UI decisions (`docs/UI.md`, all Mattan's).
- **Phase 1, `apps/web`** (`tasks/archive/phase1-todo.md`): Worker + D1, the item API, printer routes, and the phone UI.
- **Phase 2, `apps/printer`** (`tasks/archive/phase2-todo.md`): the weekly job (grouping, sheet, PDF, print, email, alerts), dry runs.
- **Phase 3 and Phase 4 preparation** (`tasks/todo.md`):
  - launchd job, `install.sh` (`--dry-run`), `uninstall.sh`, `npm run status`, `--mark-done`;
  - the Worker's Access JWT check (fails closed);
  - the Mac's Access service token;
  - `npm run deploy` / `db:migrate:remote`;
  - `docs/SETUP.md`.
- **Tests:** 101 in `apps/web`, 129 in `apps/printer`.

## Next task

**Mattan: follow `docs/SETUP.md`**. Then the first unattended Sunday, with `shipping-and-launch`: watch `npm run status`, the log, and the first emailed sheet.

## Checklist: inputs and actions needed from Mattan

**Your steps** (each explained in `docs/SETUP.md`)
- [ ] 1. Look at the sample sheet (`npm run dry-run -- --sample`).
- [ ] 2. Gmail app password → `apps/printer/.env` (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO`).
- [ ] 3. Optional: Anthropic API key → `ANTHROPIC_API_KEY` (a few cents a week; otherwise one plain list).
- [ ] 4. Cloudflare: account, `wrangler login`, `npm run deploy`, `npm run db:migrate:remote`, printer token.
- [ ] 5. Cloudflare Access: enable on the Worker, copy the team domain and AUD into `wrangler.jsonc`, redeploy, create a service token for the Mac.
- [ ] 6. On the Mac: `npm run status`, a test print (`npm run weekly -- --force`), `./install.sh`, allow notifications. Optionally, the `pmset` Sunday wake.

**Decisions to confirm** (assumptions made while you were away)
- [ ] **Catch-up:** a missed Sunday prints at the next run at home; older missed weeks are skipped. Installing marks the current week done, so it never prints by surprise.
- [ ] **No active items:** nothing is printed or emailed that week.
- [ ] **Unreachable printer:** retry hourly, then email the PDF after 24 hours. A job stuck for 5 minutes is cancelled.
- [ ] **Alerts:** a macOS notification for lasting problems, once a week.
- [ ] **Grouping:** `claude-sonnet-5-5` at effort `high`, with Anthropic's automatic refusal fallback.
- [ ] **The sheet's look:** it follows `docs/PRINT_LAYOUT.md`; the rest is my choice.

**Approve** (added without asking)
- [ ] `@anthropic-ai/sdk` (runtime), plus `typescript` and `@types/node` (dev) in `apps/printer`.

## Open questions

None open. Print time is Sundays 09:00, and items don't expire; both decided 2026-10-11.

## Notes for the next session

- Commits go to `origin`. `/build` (upstream copy) commits each finished task. Specs live in `spec/` (`SPEC-web.md`, `SPEC-printer.md`) so `/build auto` can find them; finished task lists move to `tasks/archive/`.
- Skills live in `.agents/skills/` (committed), linked from `.claude/skills/`. If they go missing: `npx skills experimental_install`.
- The UI is Mattan's to design: ask before any visual or interaction change, and record the answer in `docs/UI.md`. A private options page with the earlier choices: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- Local dev needs `apps/web/.dev.vars` (copy `.dev.vars.example`) and `npm run db:migrate:local` once. See `apps/web/CLAUDE.md` for gotchas.
- `apps/printer` dry runs read `apps/printer/.env` (copy `.env.example`); its placeholders point at the local web app. See `apps/printer/CLAUDE.md`.
