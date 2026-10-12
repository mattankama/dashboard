# Current status

_Last updated: 2026-10-12_

## Phase

**Phase 4 is under way, on Mattan's side.** Phases 1–3 are done. Mattan deployed the app (its database id is recorded in `wrangler.jsonc`). When turning on Cloudflare Access asked for a card, he chose to skip it, so on 2026-10-12 the app got its own password instead (Phase 4b, `tasks/todo.md`). What's left are Mattan's steps in **`docs/SETUP.md`**: step 5 (the password) and step 6 (the Mac). Claude hasn't deployed, printed, emailed or loaded anything into launchd. Everything is pushed to `github.com/mattankama/dashboard` (private, `main`).

## Done

- Product context, architecture, print layout and decision log (`docs/`); UI decisions (`docs/UI.md`, all Mattan's).
- **Phase 1, `apps/web`** (`tasks/archive/phase1-todo.md`): Worker + D1, the item API, printer routes, and the phone UI.
- **Phase 2, `apps/printer`** (`tasks/archive/phase2-todo.md`): the weekly job (grouping, sheet, PDF, print, email, alerts), dry runs.
- **Phase 3 and Phase 4 preparation** (`tasks/archive/phase3-todo.md`): launchd job, `install.sh` (`--dry-run`), `uninstall.sh`, `npm run status`, `--mark-done`, `npm run deploy` / `db:migrate:remote`, and `docs/SETUP.md`.
- **Phase 4b, a password instead of Cloudflare Access** (`tasks/todo.md`):
  - `POST /api/login` and a signed, year-long session cookie; fails closed without the secrets;
  - the sign-in screen Mattan chose;
  - security headers for the API and the page;
  - the Access check and the Mac's service token are gone.
- **Tests:** 102 in `apps/web`, 124 in `apps/printer`.

## Next task

**Mattan: `docs/SETUP.md` step 5 (the password), then step 6.** Then the first unattended Sunday, with `shipping-and-launch`: watch `npm run status`, the log, and the first emailed sheet.

## Checklist: inputs and actions needed from Mattan

**Your steps** (each explained in `docs/SETUP.md`)
- [ ] 1. Look at the sample sheet (`npm run dry-run -- --sample`).
- [x] 2. Gmail app password → `apps/printer/.env` (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO`). Set; the first real email (step 6) tests it.
- [ ] 3. Optional: Anthropic API key → `ANTHROPIC_API_KEY` (a few cents a week; otherwise one plain list).
- [x] 4. Cloudflare: account, `wrangler login`, `npm run deploy`, `npm run db:migrate:remote`, printer token. On 2026-10-12 `npm run status` reached the deployed app's printer route (0 items).
- [ ] 5. Your password: `npm run deploy` again, `LOGIN_PASSWORD` and `SESSION_SECRET` with `npx wrangler secret put`, then sign in on the phone and Add to Home Screen. No card and no Zero Trust.
- [ ] 6. On the Mac: `npm run status`, a test print (`npm run weekly -- --force`), `./install.sh`, allow notifications. Optionally, the `pmset` Sunday wake. (On 2026-10-12 the printer didn't answer on the network; it needs to be on for this.)

**Decisions to confirm** (assumptions made while you were away)
- [ ] **Catch-up:** a missed Sunday prints at the next run at home; older missed weeks are skipped. Installing marks the current week done, so it never prints by surprise.
- [ ] **No active items:** nothing is printed or emailed that week.
- [ ] **Unreachable printer:** retry hourly, then email the PDF after 24 hours. A job stuck for 5 minutes is cancelled.
- [ ] **Alerts:** a macOS notification for lasting problems, once a week.
- [ ] **Grouping:** `claude-sonnet-5-5` at effort `high`, with Anthropic's automatic refusal fallback.
- [ ] **The sheet's look:** it follows `docs/PRINT_LAYOUT.md`; the rest is my choice.
- [ ] **Sign-in details** beyond your choice (`docs/UI.md`): the arrow stays muted until there's a password, a wrong password clears the field, the date doesn't flip while signed out, and there's no sign-out button (a new `SESSION_SECRET` signs every device out).

**Approve** (added without asking)
- [ ] `@anthropic-ai/sdk` (runtime), plus `typescript` and `@types/node` (dev) in `apps/printer`.

## Open questions

None open. Print time is Sundays 09:00, and items don't expire; both decided 2026-10-11.

## Notes for the next session

- Commits go to `origin`. `/build` (upstream copy) commits each finished task. Specs live in `spec/` (`SPEC-web.md`, `SPEC-printer.md`) so `/build auto` can find them; finished task lists move to `tasks/archive/`.
- Skills live in `.agents/skills/` (committed), linked from `.claude/skills/`. If they go missing: `npx skills experimental_install`.
- The UI is Mattan's to design: ask before any visual or interaction change, and record the answer in `docs/UI.md`. A private options page with the earlier choices: https://claude.ai/artifact/4XDzBZaW3WPE2JxbcbraZa
- Local dev needs `apps/web/.dev.vars` (copy `.dev.vars.example`) and `npm run db:migrate:local` once. See `apps/web/CLAUDE.md` for gotchas. On 2026-10-12, local dev moved to a new D1 file once the real database id was recorded; Claude re-created the tables and copied the local items over.
- `apps/printer` dry runs read `apps/printer/.env` (copy `.env.example`); its placeholders point at the local web app. See `apps/printer/CLAUDE.md`.
