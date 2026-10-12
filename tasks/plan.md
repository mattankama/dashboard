# Implementation Plan: Phase 3 (launchd) and Phase 4 preparation

Specs: `spec/SPEC-printer.md` → "Phase 3", `spec/SPEC-web.md` → "Phase 4 (prepared without an account)". Tasks: `todo.md`. Earlier phases: `archive/`.

## Overview

Make the print job run itself every hour on the Mac, and prepare everything for going online that doesn't need Mattan's Cloudflare account: the Access check in the Worker, the Mac job's service token, deploy scripts, and a setup guide. Mattan asked to continue without questions. Loading launchd, deploying and creating secrets stay his steps and go in `docs/SETUP.md`.

## Decisions

- **launchd user agent** `org.dashboard.weekly`: hourly plus at load, Node's full path written in at install, system `PATH`.
- **The installer marks this week done** so installing never prints by surprise. `--print-this-week` opts out.
- **The Access JWT is checked with WebCrypto**, no `jose`: about 60 lines instead of a dependency. JWKS cached per isolate.
- **The check fails closed** on any host except `localhost`.
- **Access settings are plain `vars`** (the AUD tag and team domain aren't secrets). The printer token stays a `wrangler secret`.

## Tasks

| # | Task | Size |
|---|---|---|
| 1 | Printer: `--status`, `--mark-done`, log echo only in a terminal | M |
| 2 | Printer: launchd job file + `install.sh` / `uninstall.sh` (`--dry-run`) | M |
| 3 | Web: Access JWT check for `/api/*` (fail closed off localhost) | M |
| 4 | Printer: send the Access service token when configured | S |
| 5 | Web: deploy scripts and Access `vars` placeholders | S |
| 6 | `docs/SETUP.md`, status/docs updates, final check from a clean clone | M |

## Risks

| Risk | Mitigation |
|---|---|
| A path with spaces or `&` breaks the job file | Render in TypeScript with XML escaping, unit-tested; `plutil -lint` in the installer |
| nvm's Node path changes after an upgrade | The installer resolves it at install time; the guide says to re-run `install.sh` |
| The Access check locks Mattan out | `localhost` is unaffected; the guide's order (deploy → Access → vars → redeploy) and `npm run status` make problems visible |
| The JWKS fetch can't be tested against Cloudflare | Tests mock the certs URL with the Workers test integration's request mocking |
