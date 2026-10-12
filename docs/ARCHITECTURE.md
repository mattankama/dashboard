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

## Repo layout (planned)

```
apps/web/       Cloudflare Worker: API + static UI, D1 migrations, wrangler.toml
apps/printer/   Mac weekly job: fetch, group, render, print, email
  launchd/      org.dashboard.weekly.plist
  install.sh    copies the plist to ~/Library/LaunchAgents and loads it
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

## API (Worker)

UI routes sit behind Cloudflare Access:

- `GET /api/items?status=active|archived`
- `POST /api/items` with `{ text, category?, pinned? }`
- `PATCH /api/items/:id` with `{ text?, category?, pinned?, archived? }`
- `DELETE /api/items/:id`

Printer routes use a bearer token (`PRINTER_TOKEN`), with an Access service-token bypass for this path only:

- `GET /api/printer/items`: active items only
- `POST /api/printer/runs`: records a print run

## Weekly job (`apps/printer`)

launchd starts it **every hour**. Every run is safe to repeat:

```
if this week's marker exists                 → exit (already done)
if now < target time (default Sun 09:00)     → exit
build sheet:
  items  = fetch active items
  groups = claudeGroup(items)  ── on any error/invalid output ──▶ fallbackGroup(items)
  html   = render(groups)
  pdf    = chrome --headless --print-to-pdf
if printer reachable:
  lp -d CanonMF4800 pdf → wait for lpstat completion
  email "Your dashboard printed" with PDF attached
  write marker, record run
else if now > target + 24h:
  email "Couldn't reach the printer; here's your sheet" with PDF attached
  write marker, record run (emailed_only)
else:
  log and exit; retry next hour
```

Flags: `--dry-run` (write `out/weekly-YYYY-MM-DD.pdf` only), `--force` (ignore marker and target time).

### Claude grouping

- Model: `claude-sonnet-5-5`. One call per week, so cost is negligible.
- Input: item ids, text and categories (if any).
- Output: structured JSON `{ groups: [{ heading, itemIds[] }] }`.
- Instructions:
  - Group similar items.
  - Use short, plain headings.
  - Don't rewrite, summarize or comment.
  - Every id appears exactly once.
- Validate the output by checking that the set of ids equals the input set exactly. Anything else counts as a failure.
- `fallbackGroup`: group by `category` (uncategorized items go under "Other"). If there are no categories, use one list.
- Pinned items stay at the top of their group.
- Item text is untrusted user data. Send it inside clearly delimited data, never as part of the instructions. The id-set validation also catches any output that drops or invents items.

### Printer

- macOS CUPS queue: **`CanonMF4800`** (Canon imageCLASS MF4800 series, mono laser). It's reached over Wi-Fi using AirPrint/Bonjour: `dnssd://CanonMF4800._pdl-datastream._tcp.local.`
- It's already the system default printer, so no driver install is needed.
- Print with `lp -d CanonMF4800 -o media=Letter <file.pdf>`, then check the job with `lpstat -W not-completed`.
- Reachability: `lpstat -p CanonMF4800` plus a Bonjour lookup (`dns-sd`/`ippfind`). Off the home network the lookup fails, and the job waits for the next hour.
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
