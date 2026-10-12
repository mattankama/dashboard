# Spec: `printer` (Phase 2: the weekly job, with `--dry-run`)

_Status: **built and checked 2026-10-11**, under Mattan's instruction to finish Phase 2 without questions. Every assumption below is on the checklist in `docs/STATUS.md` for Mattan to confirm or change._

Module id: `printer`. It consumes the `web` module's printer routes (`spec/SPEC-web.md`).

## Objective

Every week, without anyone touching anything, the Mac turns Mattan's active items into a one-page sheet, prints it on the home Canon, and emails the PDF. When the printer can't be reached, it keeps trying, and after a day it emails the sheet instead. Nothing fails silently.

**Decided by Mattan (2026-10-11):** the sheet prints **Sundays at 09:00**. Items **never expire**; Mattan archives them by hand.

**User stories**

1. On Sunday morning a sheet comes out of the printer, and an email "Your dashboard printed" arrives with the PDF attached.
2. If the laptop was away or asleep, the sheet prints the next time the job runs at home, before the following Sunday.
3. If the printer stays unreachable for 24 hours after the target time, the email "Couldn't reach the printer; here's your sheet" arrives with the PDF instead.
4. Mattan can preview the sheet any time with `npm run dry-run`: it writes the PDF to `out/` and doesn't print, email, or mark the week as done.
5. If something breaks, it's in `~/Library/Logs/dashboard.log`, and Mattan is told: by email, or by a macOS notification if email fails too.

**Phase 2 builds the job and runs it only with `--dry-run`.** Installing it in launchd is Phase 3. The first real print and the first real email need Mattan's OK (`CLAUDE.md`).

## Assumptions (Mattan to confirm; also in the checklist)

1. **Catch-up rule.** The job always looks at the most recent Sunday 09:00 that has passed. If that week isn't done, it prints now. Older missed weeks are skipped. A first install mid-week therefore prints straight away (Phase 3 can pre-mark the current week).
2. **Week id** = the ISO week of that Sunday (e.g. `2026-W41`). The sheet's header shows that Sunday to the following Saturday (e.g. "Oct 11 – Oct 17, 2026").
3. **No active items** → nothing is printed or emailed. The week is marked done and the event is logged. (No run is recorded, because the API's statuses don't include "skipped".)
4. **The printer counts as reachable** when its CUPS queue is enabled and its Bonjour service answers within 3 seconds. A print job that hasn't finished within 5 minutes is cancelled, so it can't print twice later, and that counts as unreachable for this hour.
5. **Email goes through macOS's built-in `curl`** to Gmail SMTP (`smtps://smtp.gmail.com:465`) with an app password. The credentials are passed to `curl` on stdin, so they never appear in the process list. It is only ever sent to the single address in `NOTIFY_TO`.
6. **Grouping uses Claude** (`claude-sonnet-5-5`, as `CLAUDE.md` says) through the official SDK `@anthropic-ai/sdk`, the job's only runtime package. A JSON schema constrains the answer (structured outputs). Refusals are re-routed with Anthropic's `fallbacks: "default"`. With no `ANTHROPIC_API_KEY`, or on any error or invalid answer, the sheet is one plain list (or grouped by category, if any item has one).
7. **The PDF is made by the installed Chrome**, headless with a throwaway profile. To fit one page it tightens spacing first, then shrinks the type, never below 10pt. Two pages is the limit; anything longer still prints, and a warning is logged.
8. **Last-resort alert:** if the email can't be sent, a macOS notification (`osascript`) says so.
9. **One run at a time:** a lock file stops overlapping runs.
10. **Dev-only packages:** `typescript` (already used by `web`) and `@types/node`. Node 24 runs the TypeScript directly (type stripping), and tests use Node's built-in runner, so there's no build step and no test framework to install.

## Tech Stack

| What | Choice |
|---|---|
| Runtime | Node 24 (nvm), running `.ts` files directly; ES modules |
| Claude | `@anthropic-ai/sdk` 0.133.0 (runtime dependency), model `claude-sonnet-5-5` |
| PDF | Google Chrome (installed): `--headless=new --print-to-pdf` |
| Printing | macOS CUPS: `lp`, `lpstat`, `cancel`; Bonjour: `dns-sd` |
| Email | macOS `curl` (SMTPS) to Gmail |
| Alerts | macOS `osascript` notification |
| Tests | `node --test` (built in), `node:assert` |
| Types | `typescript` 7.0.2, `@types/node` 24.19.2 (dev only) |

## Configuration (`apps/printer/.env`, git-ignored; `.env.example` committed)

| Name | Required for | Default / placeholder |
|---|---|---|
| `DASHBOARD_API_URL` | real runs, dry runs without `--sample` | `http://localhost:8787` (local `wrangler dev`) |
| `PRINTER_TOKEN` | same | `dev-token` (matches `apps/web/.dev.vars.example`) |
| `ANTHROPIC_API_KEY` | grouping (optional) | unset: fallback grouping |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `NOTIFY_TO` | real runs | unset: placeholders in `.env.example` |
| `PRINT_DAY`, `PRINT_TIME` | – | `Sun`, `09:00` |
| `PRINTER_NAME` | – | `CanonMF4800` |
| `CHROME_PATH` | – | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| `DASHBOARD_STATE_DIR`, `DASHBOARD_LOG_FILE` | – | `~/Library/Application Support/dashboard`, `~/Library/Logs/dashboard.log` |

A real run with required settings missing logs the problem, shows a notification, and exits with code 1. It doesn't just quietly do nothing.

## The weekly run

```
node src/weekly.ts [--dry-run] [--force] [--sample]

lock (else exit: another run is going)
target = most recent PRINT_DAY PRINT_TIME <= now; week = ISO week of target
if not --force and week is marked done          -> exit 0
items = GET /api/printer/items  (or sample items with --sample)
if no items                                     -> mark done, log, exit 0
groups = Claude grouping, validated  -- any failure -> fallback grouping
pdf = Chrome(render(groups)), fitted to 1 page (max 2)
if --dry-run                                    -> write out/weekly-<Sunday>.pdf, exit 0
if printer reachable and print job completes    -> email "Your dashboard printed"; mark done;
                                                   POST /api/printer/runs { status: printed }
else if now > target + 24h                      -> email "Couldn't reach the printer; here's your sheet";
                                                   mark done; record { status: emailed_only }
else                                            -> log "printer unreachable, will retry"; exit 0
email failure -> notification + log; if nothing reached Mattan, record { status: failed }
```

`--force` ignores the done marker. `--sample` uses built-in example items and implies `--dry-run`.

## The sheet (`docs/PRINT_LAYOUT.md`)

US Letter, 0.75in margins, black and white only, Charter (as in the app).
- **Header:** "Dashboard" and the week's date range.
- **Groups:** largest first. Each has a semibold heading with a thin rule under it, then its items as a bulleted list. Pinned items come first in their group, marked ★. Item text is exactly as written; HTML in it is escaped.
- **Footer:** "Printed Sun Oct 11 · 14 items".
- **Not on the sheet:** commentary, summaries, checkboxes or QR codes.

## Grouping rules (`CLAUDE.md`: the in-app AI only groups)

- **Input:** item ids, text and categories (when set). The data sits in a delimited block, and the instructions say it is data. Every `<` in the JSON is escaped, so an item can't close the block.
- **Output** (JSON schema): `{ groups: [{ heading, itemIds[] }] }`.
- **Valid** only if:
  - every input id appears exactly once, with none unknown;
  - every heading is non-empty and at most 60 characters.
  - Empty groups are dropped.
- **Anything else** (an API error, a timeout, a refusal, hitting `max_tokens`, bad JSON, or a failed check) uses the fallback grouping. Every failure is logged, without item text.

## Commands

All run from `apps/printer/`:

```
npm install
cp .env.example .env          # then fill in (placeholders work for dry runs)
npm run dry-run               # out/weekly-<date>.pdf from the API in .env
npm run dry-run -- --sample   # same, with built-in example items (no API needed)
npm test                      # node --test (fakes only: never prints or emails)
npm run typecheck             # tsc --noEmit
npm run build                 # same as typecheck (no build step); /build runs it
npm run weekly                # the real thing: what launchd will run in Phase 3
```

## Project Structure

```
apps/printer/
  CLAUDE.md  package.json  tsconfig.json  .env.example
  src/
    weekly.ts      CLI: flags, config, wiring, exit codes
    config.ts      .env loading, defaults, validation
    schedule.ts    target time, ISO week, date labels (pure)
    api.ts         Dashboard API: items, runs
    group.ts       Claude grouping, validation, fallback, ordering
    render.ts      the sheet's HTML (pure)
    pdf.ts         Chrome → PDF, page count, fitting
    printer.ts     reachability, lp, completion, cancel
    email.ts       MIME message (pure), sending via curl
    notify.ts      macOS notification
    state.ts       done markers, lock
    log.ts         log file
    job.ts         the weekly decision flow (all effects injected)
    run.ts         small child-process helper with timeouts
  test/            *.test.ts, plus fake HTTP/SMTP servers
  out/             dry-run PDFs (git-ignored)
```

## Code Style

The same as `apps/web`: small functions, results instead of throws where callers branch, and effects injected so tests can fake them.

```ts
export async function runWeekly(deps: JobDeps, options: RunOptions): Promise<JobOutcome> {
  const target = mostRecentTarget(deps.now(), deps.config.schedule);
  const week = isoWeek(target);
  if (!options.force && (await deps.state.isDone(week))) return { kind: "already-done", week };
  // ...
}
```

## Testing Strategy

- **Pure logic, unit-tested:** schedule math (DST, year ends), grouping validation and fallback, ordering, HTML rendering and escaping, the MIME message, and config parsing.
- **Integration tests with fakes:**
  - a fake Dashboard API and a fake Anthropic API (both local HTTP servers, so the real SDK code runs);
  - a fake SMTP server, which the real `curl` talks to;
  - Chrome for real (skipped if missing), checking the PDF's page count.
- **The weekly flow** is tested with every effect faked, by moving the clock:
  - already done, before the target, a catch-up;
  - unreachable and retrying, then over 24h so it emails only;
  - no items, and Claude failing;
  - email failing, so a notification shows.
- **Never** `lp`, a real SMTP server, or the real Claude API in tests. The real API is only called by a dry run with Mattan's key.

## Boundaries

- **Always:** run tests and the typecheck. Keep item text and secrets out of logs. Validate every Claude answer. Keep effects injectable.
- **Ask first (normally):** a real print, a real email, loading launchd, `sudo`/`pmset`, and new dependencies. In this phase Mattan said not to ask: so no real print or email happens at all, and new packages go on the checklist.
- **Never:** print or email from tests or dry runs. Send email to anyone but `NOTIFY_TO`. Let Claude's text reach the sheet (headings aside). Put secrets in the repo.

## Success Criteria

1. `npm test`, `npm run typecheck` pass. From a clean clone, `npm ci && npm run dry-run -- --sample` writes a one-page PDF.
2. `npm run dry-run` against the local `wrangler dev` makes a PDF of the real active items, grouped (with a key) or as one list (without).
3. The weekly flow's tests cover every branch of "The weekly run" above, including catch-up, the 24h email-only path, and every failure fallback.
4. Grouping can't add, drop, duplicate or reword items: a test feeds back invalid answers, each of which falls back.
5. Email builds a valid MIME message with the PDF, and the `curl` path delivers it to a local fake SMTP server.
6. Printing logic is tested with a fake `lp`/`lpstat`. Nothing is printed during Phase 2.
7. `apps/printer/CLAUDE.md`, the root `CLAUDE.md` commands, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and the checklist in `docs/STATUS.md` are up to date.

## Out of scope

launchd (Phase 3), `pmset` wake, deploying the Worker (Phase 4), item expiry (decided: none).
