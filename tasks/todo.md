# Tasks: Phase 4b, a password instead of Cloudflare Access

Plan: `tasks/plan.md`. Standard checks: `npm test`, `npm run typecheck`, `npm run build` in each app touched.
Never deploy or set secrets in these tasks.

- [x] **Task 1: Signing in, on the server** (`52d9820`)
  - `POST /api/login` checks `LOGIN_PASSWORD` in constant time and sets the `__Host-` session cookie (HMAC under `SESSION_SECRET` of the expiry and the password, a year).
  - Every `/api/*` route except login and the printer's needs a session (`401`). Missing or short secrets give `503`; `localhost` is open only while neither is set.
  - API replies: `no-store`, `nosniff`. `public/_headers`: CSP and friends.
  - The Access check and its `vars` are gone. Tests cover tampering, expiry, old secrets and passwords, and the headers.
- [x] **Task 2: The sign-in screen** (`b6e7222`)
  - Any `401` shows today's page with the password field at the bottom (`docs/UI.md`). Wrong password: "Wrong password.", field cleared.
  - Checked in headless Chrome at phone and laptop sizes, including a session ending mid-use; no console errors or CSP reports.
- [x] **Task 3: The printer without Access** (`8687bc1`)
  - Reverted the `CF_ACCESS_*` service-token support; the job only needs `PRINTER_TOKEN`.
- [x] **Task 4: Docs**
  - `docs/SETUP.md` step 5 is now "Choose your password". `ARCHITECTURE.md`, `DECISIONS.md`, `SPEC-web.md`, `STATUS.md` and the `CLAUDE.md` files match.
