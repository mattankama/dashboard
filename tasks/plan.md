# Implementation Plan: Phase 4b, a password instead of Cloudflare Access

Spec: `spec/SPEC-web.md` → "Phase 4b". Tasks: `todo.md`. Earlier phases: `archive/`.

## Overview

Turning on Zero Trust asked Mattan for a card, and he chose to skip it. The Worker now signs him in itself, with the sign-in screen he chose ("password at the bottom"). Deploying and setting the secrets stay his steps (`docs/SETUP.md`, step 5).

## Decisions

- **One password and a signed, year-long cookie:** no user table, session store, schema change or new dependency.
- **The password is part of what's signed**, so a new password signs every device out, as does a new `SESSION_SECRET`.
- **Fails closed:** missing or short secrets mean `503` everywhere except a `localhost` with no login set.
- **No rate limit**, on purpose (`docs/DECISIONS.md`).

## Tasks

| # | Task | Size |
|---|---|---|
| 1 | Web: `/api/login`, the session check, API and page headers; remove the Access check | M |
| 2 | Web: the sign-in screen | M |
| 3 | Printer: remove the Access service token | S |
| 4 | Docs: setup step 5, architecture, decisions, spec, status | S |

## Risks

| Risk | Mitigation |
|---|---|
| Mattan forgets the password | It's saved in the Passwords app; a new one can be set any time (`docs/SETUP.md`) |
| A deploy without the secrets runs open | `503` until both are set and long enough; tested |
| A password manager's fill isn't readable until a key is pressed | `autocomplete="current-password"` plus a hidden username; the arrow is never disabled for being empty, so Return still submits |
