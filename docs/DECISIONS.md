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
Cloudflare Access protects the app at the edge; the Worker also verifies Access's signed token on the item API, in case a route ever ends up outside Access. WebCrypto does the RS256 check in about 60 lines, so `jose` isn't needed. Off `localhost`, missing Access settings mean `503`, never open. _Replaced below by the app's own password._

### 2026-10-12: Access on the free workers.dev address, with a service token for the Mac
No custom domain is needed: Access can protect a Worker's `workers.dev` address directly. The Mac job gets through with an Access service token (two headers), plus the printer's own bearer token. _Replaced below by the app's own password._

### 2026-10-12: The Worker has its own password instead of Cloudflare Access
Turning on Zero Trust asked for a payment card and permission to charge usage beyond the free limits, and Mattan chose not to give one. The Worker now signs him in itself: one password (`LOGIN_PASSWORD`, a wrangler secret) gets a signed session cookie that lasts a year. The cookie is an HMAC under `SESSION_SECRET` of its expiry and the password, so there's no user table, session store or new dependency, and Workers + D1 still need no card. Sessions can't be revoked one at a time. Changing either secret signs every device out, which suits one person with a phone and a laptop. Missing or short secrets mean `503`, never open. The printer routes keep their own bearer token. Mattan chose the sign-in screen (`docs/UI.md`).

### 2026-10-12: No rate limit on signing in, on purpose
The Workers rate-limiting binding's terms on the free plan weren't confirmed, and a counter in D1 would change the schema. Instead the password must be at least 16 characters (the guide generates 24 random ones), and the free plan's 100,000 requests a day caps guessing far below what such a password would need. Wrong passwords are logged (without the password) in Workers Logs. Revisit if the password ever gets weaker or the app gets more users.

### 2026-10-12: The page stays put when the iPhone keyboard opens
On iPhone the keyboard covers the page instead of resizing it, and Safari slides the whole page up to show the focused field, which pushed the date and the items off the screen. Safari has nothing to change that: no `interactive-widget` (WebKit bug 259770), no VirtualKeyboard API (bug 230225), and `dvh`, `lvh` and `innerHeight` ignore the keyboard. It pans even with `overflow: hidden` (bug 240860). So the page never scrolls (a fixed page with the list scrolling inside it), and `public/keyboard.js` does two things:
- It focuses fields "in place", moving the field out of sight for the moment of `focus()` so Safari finds nothing to scroll to, then putting it back. On the add and password fields that happens on the tap's `touchend`. This is Base UI's current approach, confirmed on iOS 26.5 and 27 (`DrawerVirtualKeyboardProvider`); react-aria and Ionic use variants of it.
- It sizes the page to `visualViewport.height` while a field is focused. The change animates at about the keyboard's pace (260ms `cubic-bezier(.32,.72,0,1)`, Base UI's estimate).

There are two backstops. If Safari pans anyway, the page is scrolled back. And the list is always 1px scrollable, because Safari lets a drag on content that can't scroll move the whole page (bug 243452). It can't be checked without an iPhone; the checks are in `docs/STATUS.md`. Fallbacks if it misbehaves there:
- If the focus trick stops working, typing still works: Safari pans, and the page is scrolled back (a visible jump).
- If the height animation stutters, move only the add field (a `transform`) and resize the list without animating it.
- If the bar ends up short of the keyboard, `visualViewport.height` is wrong at launch too (the same bug as the strip below).

### 2026-10-12: The installed app is sized from `lvh`
On launch from the Home Screen, iOS 26 can report the viewport about a status bar short, so the page ended above the screen's bottom and the darker desk colour showed there until the first scroll. That's reported in several projects, with WebKit bugs 301108 and 316008 open. Installed, the page is sized from `100lvh` from the top (in standalone there's no browser bar, so the large viewport is the screen). On phone widths the page colour is also behind everything, so any gap left over can't be seen. Not chosen: dropping `black-translucent`, which is reported to help but changes the look and means re-adding the Home Screen icon.

### 2026-10-12: Swipes use Touch Events, a flick or 40%, and a cue
On iPhone a Pointer Events swipe with `touch-action: pan-y` can be turned into a vertical scroll halfway (WebKit bugs 203335 and 232545, both open). Only `preventDefault()` on a `touchmove` stops that, so `swipe.js` uses Touch Events (as Swiper, Embla, Ionic and Telegram Web do). The numbers:
- Direction is decided after 10px: sideways if more than 1.2× as far across as down. Ionic uses 40°; Apple's WWDC18 session 803 uses 10pt.
- It acts on a flick of at least 0.4px/ms over at least 32px (Vaul 0.4, use-gesture 0.5, Ionic 0.3), or a drag past 40% of the width (Flutter's `Dismissible`; Android uses 50%).
- A flick back toward the start cancels (Flutter, Ionic, SwipeCellKit).
- Speed comes from the last 100ms of moves, and is zero if the finger stopped for 40ms (Android's `VelocityTracker`).
- Touches within 20px of the screen's sides are left to iOS (Telegram, Swiper).

On release, an item that goes back follows a critically damped spring (Apple: "100% damping, or no overshoot"), written as a CSS `linear()` easing. Items that move slide there (FLIP) rather than jump. While a finger is on an item the list isn't rebuilt; it's rebuilt right after, because a touch stays with the element it started on. Mattan chose the cue and the motion (`docs/UI.md`).

### 2026-10-12: Adding shows the item before the server answers
Mattan noticed a lag between pressing Return and the item appearing: it waited for the round trip to the Worker and D1. Now the item shows at once, under a temporary id, and the server's copy replaces it when it answers. Until then it can't be edited or swiped, because the server doesn't know its id yet. A refused save takes it away and puts its words back in the field. The field also isn't focused from script after the request anymore. On iPhone that could leave it focused with no keyboard, and the next tap then went to Safari's own focus, which slides the page. Taps on a field in that state now go through `focusInPlace()` as well.

### 2026-10-12: The bar above the iPhone keyboard stays
Mattan asked to remove the ˄ ˅ ✓ bar. A web page can't. In WebKit's source (`WKContentViewInteraction.mm`, `_elementTypeRequiresAccessoryView`), every text field, text area and editable area gets it on a small screen. The only off switch, `accessoryViewShouldNotShow`, belongs to a native app that embeds WebKit. A native wrapper would be a new moving part (an Xcode project, signing, updates), so it isn't worth it for this. The page already sits the add field on top of the bar.
