# Tasks: Phase 3 (launchd) and Phase 4 preparation

Plan: `tasks/plan.md`. Standard checks: `npm test`, `npm run typecheck`, `npm run build` in each app touched.
Never load launchd, deploy, print or email in these tasks.

- [x] **Task 1: Printer status, mark-done, quieter logs**
  - `node src/weekly.ts --status` (and `npm run status`) prints a plain-English health check:
    - the next print time and this week's state;
    - the last run, and whether it's installed;
    - missing settings (names only);
    - whether the printer and web app answer.
  - It has no side effects. Its formatting is pure and tested.
  - `--mark-done` marks this week done (for `install.sh`) and is tested.
  - Log lines echo to the terminal only when stdout is one, so launchd's own log stays for crashes.
- [x] **Task 2: launchd job and installer**
  - `src/launchd.ts` renders the job file (XML-escaped; unit-tested).
  - `install.sh [--dry-run] [--print-this-week]` and `uninstall.sh`.
  - Verify: `./install.sh --dry-run` passes `plutil -lint`; `bash -n` on both scripts. Nothing is loaded.
- [x] **Task 3: Access check in the Worker**
  - `/api/*` except `/api/printer/*` needs a valid `Cf-Access-Jwt-Assertion` (RS256, team certs, `aud`, `iss`, `exp`/`nbf`), else `403`. `localhost` skips the check. Off `localhost`, missing settings return `503`.
  - Tests use generated keys and mocked certs.
- [x] **Task 4: Service token from the Mac**
  - `CF_ACCESS_CLIENT_ID`/`CF_ACCESS_CLIENT_SECRET` (both or neither) are sent on printer API requests. Tested; added to `.env.example`.
- [ ] **Task 5: Deploy scripts**
  - `npm run deploy`, `npm run db:migrate:remote`, and `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` `vars` placeholders. `npm run build` still bundles.
- [ ] **Task 6: Setup guide and docs**
  - `docs/SETUP.md` gives Mattan's steps in order.
  - Update the app `CLAUDE.md` files, `ARCHITECTURE.md` (including the `pmset` fix), `DECISIONS.md` and `STATUS.md`.
  - Final clean-clone check for both apps.
