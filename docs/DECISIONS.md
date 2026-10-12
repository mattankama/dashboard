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
