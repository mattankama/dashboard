# Decisions

Short log of the choices made, newest at the bottom. Add an entry whenever a choice is changed.

### 2026-10-11: Print from the Mac, not a Raspberry Pi
The Canon MF4800 has no cloud printing, so jobs have to come from the home network. Mattan's Mac is usually home and already has the printer set up. The job runs hourly and catches up after sleep or travel, so a laptop is good enough. The printer job only needs Node, Chrome and `lp`, so moving to a Pi later means copying `apps/printer` over and switching to a cron entry.

### 2026-10-11: Cloudflare Workers + D1 for the web app and storage
It's free and has no servers to look after. It doesn't pause from inactivity like Supabase's free tier does. Cloudflare Access handles login with no auth code to write. Capture works even when the Mac is asleep.

### 2026-10-11: Headless Chrome for the PDF
Chrome is already installed. WeasyPrint would need Homebrew and native libraries, and Playwright would mean a large download. Chrome's `--print-to-pdf` from HTML/CSS is enough for a one- or two-page sheet.

### 2026-10-11: Email instead of push notifications
Mattan chose email. It doubles as a digital copy (PDF attached) and needs no extra app. It's sent with Gmail SMTP and an app password.

### 2026-10-11: Claude only groups
Mattan wants Claude to look over the items each week but not be obtrusive. It groups similar items under plain headings and does nothing else: no focus line, no staleness flags, no rewording. If grouping fails, the sheet falls back to user categories or one list, so the print still happens.

### 2026-10-11: UI design is Mattan's call
Mattan wants a UI that doesn't feel generic, so Claude asks before making any visual choice instead of deciding. Settled so far: dark theme only, a warm amber accent, paper-planner type, the add field at the bottom, swipe to archive and tap to edit, and no buttons that could be hidden away. Details and the remaining questions are in `docs/UI.md`.

### 2026-10-11: `@cloudflare/vitest-plugin` instead of `@cloudflare/vitest-pool-workers`
Cloudflare renamed the Workers test integration, and the old package is deprecated with no further updates. Mattan approved the swap. It's the same team and the same API style (`cloudflareTest()` plugin, `env`/`exports` from `cloudflare:workers`). It also dropped the older wrangler copy the old package pulled in, which cleared `npm audit`.

### 2026-10-11: The look, and no categories in the UI
Mattan chose from an options page: a dot-grid journal page, Charter (built into Apple devices, so no font files), a honey amber accent, today's date as the heading, a blank dot row between items, and a centered phone-width page on laptops. Mattan also chose **no categories in the UI**. This replaces the earlier "optional category with suggestions" call: Claude groups the printed sheet, and the fallback is one list. The API keeps its optional `category` field (already built and tested, harmless), and Task 8 (category suggestions) is dropped. Details in `docs/UI.md`.

### 2026-10-11: The web app has no framework, router library or build step
One screen and seven routes don't need them. The UI is static files with `// @ts-check` JavaScript that `tsc` still checks, and the Worker matches routes with the built-in `URLPattern`. Fewer moving parts to update or break. `wrangler.jsonc` replaces the planned `wrangler.toml`, as Cloudflare now recommends.

### 2026-10-11: A delete waits for its undo line
Mattan chose to delete without a confirmation, plus an undo line. So nothing is sent until the line goes away (or the view flips, or the page is hidden, using `keepalive`), and an undone delete never reaches the server.

### 2026-10-11: The print job runs TypeScript directly on Node 24, with no build step
Node 24 strips the types itself, has a test runner (`node --test`), `fetch`, and a `.env` loader built in. So `apps/printer` needs no bundler, test framework or dotenv. `tsc --noEmit` still checks the types. Dev-only packages: `typescript`, `@types/node`.

### 2026-10-11: `@anthropic-ai/sdk` is the print job's only runtime package
The Claude API skill requires the official SDK in a TypeScript project, rather than raw `fetch`. Mattan asked for Phase 2 without questions, so this is on the checklist in `docs/STATUS.md` to approve after the fact.

### 2026-10-11: Email through macOS's `curl`, not a mail library
`curl` is built into macOS and speaks SMTPS. The app password reaches it on stdin, so it never appears in the process list. That avoids adding nodemailer (or similar) to maintain.

### 2026-10-11: When the weekly sheet happens (Phase 2 assumptions)
The job always handles the most recent Sunday 09:00 that has passed, so a Mac away on Sunday prints the sheet on its next run at home; older missed weeks are skipped. An unreachable printer is retried hourly, and after 24 hours the PDF is emailed instead. A week with no active items sends nothing. Lasting problems (missing settings, the API, Chrome) alert once a week, not every hour. All of these are on Mattan's checklist to confirm.

### 2026-10-12: launchd runs the job hourly and at login; installing marks the week done
`RunAtLoad` plus `StartInterval` 3600 covers sleep, travel and reboots without a separate catch-up mechanism. `install.sh` writes Node's full path into the job (launchd doesn't load nvm) and marks the current week done first, so installing never prints by surprise. Loading it stays Mattan's step.

### 2026-10-12: The Worker checks Access's JWT itself, with WebCrypto, and fails closed
Cloudflare Access protects the app at the edge; the Worker also verifies Access's signed token on the item API, in case a route ever ends up outside Access. WebCrypto does the RS256 check in about 60 lines, so `jose` isn't needed. Off `localhost`, missing Access settings mean `503`, never open.

### 2026-10-12: Access on the free workers.dev address, with a service token for the Mac
No custom domain is needed: Access can protect a Worker's `workers.dev` address directly. The Mac job gets through with an Access service token (two headers), plus the printer's own bearer token.
