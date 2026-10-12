# Architecture

```
 Phone / any device                 Cloud (free tier)                     Mac at home
 ┌──────────────┐   HTTPS    ┌─────────────────────────────┐  pull   ┌───────────────────────────┐
 │ Dashboard     │ ────────▶ │ Cloudflare Worker + D1 (SQL) │ ◀────── │ launchd job (hourly check) │
 │ web app (PWA) │           │ behind Cloudflare Access     │  token  │  → Claude API (group only) │
 └──────────────┘           └─────────────────────────────┘         │  → HTML → PDF (headless    │
                                                                      │    Chrome)                 │
                                                                      │  → lp -d CanonMF4800       │
                                                                      │  → email PDF (Gmail SMTP)  │
                                                                      └───────────────────────────┘
```

Adding items has to work from anywhere, even when the Mac is asleep, so storage lives in the cloud. Printing has to happen on the home network, so it runs on the Mac.

## Repo layout

```
apps/web/       Cloudflare Worker: API + static UI (public/), D1 migrations, wrangler.jsonc
apps/printer/   Mac weekly job: fetch, group, render, print, email (src/*.ts, run directly by Node 24)
  launchd/      org.dashboard.weekly.plist             (Phase 3, not built yet)
  install.sh    copies the plist to ~/Library/LaunchAgents and loads it (Phase 3)
spec/           one approved spec per module
docs/
```

## Data model (D1)

`items`

| column | type | notes |
|---|---|---|
| id | text (uuid) | primary key |
| text | text | exactly what Mattan wrote; never modified by Claude |
| category | text, nullable | optional user-chosen label; used as the fallback grouping |
| pinned | integer (0/1) | pinned items print first |
| created_at | text (ISO) | |
| updated_at | text (ISO) | |
| archived_at | text (ISO), nullable | null means active |

`print_runs`

| column | type | notes |
|---|---|---|
| id | text | |
| week | text | ISO week, e.g. `2026-W41` |
| printed_at | text, nullable | |
| emailed_at | text, nullable | |
| status | text | `printed`, `emailed_only` or `failed` |
| created_at | text (ISO) | when the run was recorded, even if it failed |

## API (Worker)

UI routes sit behind Cloudflare Access:

- `GET /api/items?status=active|archived`
- `POST /api/items` with `{ text, category?, pinned? }`
- `PATCH /api/items/:id` with `{ text?, category?, pinned?, archived? }`
- `DELETE /api/items/:id`

Active items list pinned first, then newest; archived items most recently archived first. Input is validated (text 1–500 characters, trimmed only; unknown fields rejected), and mutating requests must be `application/json`.

Printer routes use a bearer token (`PRINTER_TOKEN`), with an Access service-token bypass for this path only:

- `GET /api/printer/items`: active items only
- `POST /api/printer/runs`: records a print run (`{ week, status, printedAt?, emailedAt? }`)

A wrong or missing token gets `401`; if `PRINTER_TOKEN` isn't set the routes return `503`, never open access.

## UI (`apps/web/public`)

Static HTML, CSS and `// @ts-check` JavaScript, no framework or build step. Phone-first: actions are swipes on the phone and words on a laptop. Every design choice is Mattan's and lives in `docs/UI.md`.

## Weekly job (`apps/printer`)

launchd starts it **every hour**. Every run is safe to repeat:

```
take the lock (another run going → exit)
target = the most recent Sun 09:00 that has passed; week = its ISO week (Monday catches up)
if this week's marker exists                 → exit (already done)
if settings are missing                      → alert once a week, exit
build sheet:
  items  = fetch active items               (none → mark done, nothing goes out)
  groups = claudeGroup(items)  ── on any error/invalid output ──▶ fallbackGroup(items)
  html   = render(groups)
  pdf    = chrome --headless --print-to-pdf, fitted to one page (max two)
if printer reachable and the print job finishes (else cancel it):
  email "Your dashboard printed" with PDF attached (failure → macOS notification)
  write marker, record run (printed)
else if now > target + 24h:
  email "Couldn't reach the printer; here's your sheet" with PDF attached
  write marker, record run (emailed_only); if that email fails too → notification, record failed
else:
  log and exit; retry next hour
API or Chrome failures retry hourly and alert once after 24h.
```

Flags: `--dry-run` (write `out/weekly-YYYY-MM-DD.pdf` only), `--force` (ignore the marker), `--sample` (example items; implies `--dry-run`).

State lives in `~/Library/Application Support/dashboard/` (week markers, alerts, each week's PDF, the lock, a `last-run` heartbeat); the log is `~/Library/Logs/dashboard.log`. Email goes through macOS's `curl` to Gmail SMTPS (password on stdin), and the last-resort alert is an `osascript` notification.

### Claude grouping

- Model: `claude-sonnet-5-5`. One call per week, so cost is negligible.
- Input: item ids, text and categories (if any).
- Output: structured JSON `{ groups: [{ heading, itemIds[] }] }`, enforced by a JSON schema (`output_config.format`), via `@anthropic-ai/sdk` with Anthropic's refusal fallback (`fallbacks: "default"`).
- Instructions:
  - Group similar items.
  - Use short, plain headings.
  - Don't rewrite, summarize or comment.
  - Every id appears exactly once.
- Validate the output by checking that the set of ids equals the input set exactly, and that headings are 1–60 characters. Anything else counts as a failure.
- `fallbackGroup`: group by `category` (uncategorized items go under "Other"). If there are no categories, use one list.
- Pinned items stay at the top of their group.
- Item text is untrusted user data. Send it inside clearly delimited data, never as part of the instructions. The id-set validation also catches any output that drops or invents items.

### Printer

- macOS CUPS queue: **`CanonMF4800`** (Canon imageCLASS MF4800 series, mono laser). It's reached over Wi-Fi using AirPrint/Bonjour: `dnssd://CanonMF4800._pdl-datastream._tcp.local.`
- It's already the system default printer, so no driver install is needed.
- Print with `lp -d CanonMF4800 -o media=Letter <file.pdf>`, then check the job with `lpstat -W not-completed`.
- Reachability: `lpstat -p CanonMF4800` (enabled) plus a 3-second Bonjour lookup (`dns-sd -L`) of the name in its device URI. Off the home network the lookup fails, and the job waits for the next hour.
- A job that hasn't finished within 5 minutes is cancelled, so it can't print twice when the next run retries.
- No cloud printing, so the job must run on a device on the home network.

### Mac reliability

- launchd `StartInterval` 3600 runs the job hourly. A sleeping or away laptop catches up when it's next home.
- Optional: `sudo pmset repeat wakeorpoweron Su 08:55:00` wakes the Mac before the target time when it's plugged in.

## Secrets

| Where | Name | Purpose |
|---|---|---|
| Mac `.env` | `DASHBOARD_API_URL`, `PRINTER_TOKEN` | fetch items |
| Mac `.env` | `ANTHROPIC_API_KEY` | grouping |
| Mac `.env` | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO` | email |
| Mac `.env` | `PRINT_DAY`, `PRINT_TIME`, `PRINTER_NAME` | schedule and printer (defaults: Sun, 09:00, CanonMF4800) |
| `wrangler secret` | `PRINTER_TOKEN` | auth for the printer routes |
