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
