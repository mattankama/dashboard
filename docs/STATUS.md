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
- **Phone UI fixes, 2026-10-12** (Mattan's report: the keyboard pushed the page up, a dark strip at the bottom on launch, swipes worked poorly). Researched first; Mattan chose the swipe cue and motion (`docs/UI.md`, sources in `docs/DECISIONS.md`):
  - the page no longer moves when the keyboard opens: the add field rides up on it (`keyboard.js`);
  - the Home Screen app is sized from `lvh`, and the page colour is behind everything on phones;
  - swipes use Touch Events and act on a flick or past 40%, with a cue on the item's mark, a spring back, items gliding into gaps, and pinned items sliding to the top.
  - follow-up the same day: adding shows the item at once (no wait for the server), and a tap on a field that's focused with no keyboard no longer slides the page; the bar above the keyboard can't be removed by a web page (`docs/DECISIONS.md`);
  - Checked in headless Chrome with real touch input: swipes, the cue, smooth moves, edges, catching an item mid-spring, the archive view, a faked keyboard, the laptop words, and no CSP violations. All of it is **deployed** (2026-10-12, Mattan's OK, version `d3e6ea51`, which also lines up "A clean page." with the date). The live site serves the new files and still answers `401` without a session. Nothing has been tried on an iPhone yet.
- **First real print, 2026-10-12** (Mattan asked): this week's sheet, from the deployed app's 3 items, printed on the Canon with `lp` only. No email, no week marker, no recorded run, so the real job still runs for this week. Then, at Mattan's request, every text size on the sheet became 1.5 times larger (`TEXT_SCALE`; `docs/PRINT_LAYOUT.md`).
- **Tests:** 116 in `apps/web`, 125 in `apps/printer`.
- **Security review, 2026-10-12** (`security-and-hardening`): no injection, XSS or sign-in bypass found; `npm audit` clean in both apps; no secrets in git history. The deployed app sends its CSP and refuses requests without a session (`401`) or the printer token (`401`); `workers.dev` is HSTS-preloaded. `apps/printer/.env` is now readable only by Mattan (`chmod 600`). One open item: the printer token (step 7).

## Next task

**Mattan: check the phone UI fixes on the iPhone**, from the Home Screen app (no need to re-add it; force-quit and reopen loads the new files):
1. Force-quit, then open it: no dark strip at the bottom, before or after scrolling.
2. Tap the add field: the date and items don't move, the field rides up on the keyboard with no gap, and nothing flickers. Close the keyboard: nothing is left out of place.
3. Edit an item low on the page: it ends up just above the add field. Type several lines in both fields.
   Add a few items in a row: each shows the moment Return is pressed. Close the keyboard, then tap the add field again: no glitch.
4. With the keyboard open, drag the list (short and long) and the add field: the page itself doesn't move.
5. Swipes: a quick flick and a slow drag both ways; watch the ★ and dimming appear at the point of no return; let go early; catch an item as it springs back; scroll the list starting on an item; the archive view.

If 1 or 2 fails, `docs/DECISIONS.md` (2026-10-12) lists the fallbacks. Then **`docs/SETUP.md` step 5 (the password), then step 6**, and the first unattended Sunday, with `shipping-and-launch`: watch `npm run status`, the log, and the first emailed sheet.

## Checklist: inputs and actions needed from Mattan

**Your steps** (each explained in `docs/SETUP.md`)
- [ ] 1. Look at the sample sheet (`npm run dry-run -- --sample`).
- [x] 2. Gmail app password → `apps/printer/.env` (`GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO`). Set; the first real email (step 6) tests it.
- [ ] 3. Optional: Anthropic API key → `ANTHROPIC_API_KEY` (a few cents a week; otherwise one plain list).
- [x] 4. Cloudflare: account, `wrangler login`, `npm run deploy`, `npm run db:migrate:remote`, printer token. On 2026-10-12 `npm run status` reached the deployed app's printer route (0 items).
- [ ] 5. Your password: `npm run deploy` again, `LOGIN_PASSWORD` and `SESSION_SECRET` with `npx wrangler secret put`, then sign in on the phone and Add to Home Screen. No card and no Zero Trust. (On 2026-10-12 the deployed API answered "Sign in", not "Login isn't set up", so both secrets are set.)
- [ ] 6. On the Mac: `npm run status`, a test print (`npm run weekly -- --force`), `./install.sh`, allow notifications. Optionally, the `pmset` Sunday wake. (On 2026-10-12 the printer didn't answer on the network; it needs to be on for this.)
- [ ] 7. A new printer token: the one in `apps/printer/.env` is 16 characters, not the 64 that `docs/SETUP.md` step 4 makes. It reads every active item without the password. Make one with `openssl rand -hex 32`, then `npx wrangler secret put PRINTER_TOKEN` and the same value in `.env`; `npm run status` confirms it. (Proposed after this: the Worker refuses a `PRINTER_TOKEN` under 32 characters, like the other two secrets. Awaiting Mattan's OK.)

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
