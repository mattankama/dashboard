# Implementation Plan: `printer` (Phase 2)

Spec: [`spec/SPEC-printer.md`](../spec/SPEC-printer.md). Tasks: [`todo.md`](todo.md). Phase 1's finished plan: `archive/`.

## Overview

Build `apps/printer`, the weekly job: fetch the active items, group them (with Claude, or the fallback), render the sheet, make the PDF with Chrome, print it with CUPS, email it with `curl`, and keep it all safe to re-run every hour. It's built bottom-up in slices that each run and test on their own. Each effect (network, Chrome, `lp`, SMTP, the clock) is injected, so the whole weekly flow can be tested without printing or emailing anything.

Mattan asked for this phase to run without questions, so the plan has no human gate. Open choices are assumptions in the spec and in the checklist in `docs/STATUS.md`.

## Architecture Decisions

- **No build step:** Node 24 runs the `.ts` files directly; `tsc --noEmit` checks them. Tests use `node --test`.
- **One runtime package**, `@anthropic-ai/sdk` (the Claude skill requires the SDK in a TypeScript project). Everything else uses Node or macOS built-ins: `fetch`, `process.loadEnvFile`, Chrome, `lp`/`lpstat`/`cancel`, `dns-sd`, `curl`, `osascript`.
- **Effects are injected** (`run` for commands, `fetch`, the Anthropic client's base URL, the clock, the state directory), so tests use fakes. The real SDK and real `curl` are still exercised, against local fake servers.
- **`job.ts` holds every weekly decision** as one function over those injected effects. `weekly.ts` only wires up real effects and sets the exit code.

## Dependency Graph

```
T1 scaffold/config/log ─┬─▶ T2 schedule ──────────────────────┐
                        ├─▶ T3 API client ─────────────────────┤
                        ├─▶ T4 grouping (Claude + fallback) ───┤
                        └─▶ T5 render ──▶ T6 PDF + dry run ────┤
                            T7 printer ────────────────────────┤
                            T8 email + notification ───────────┴─▶ T9 state + weekly flow ──▶ T10 docs + final check
```

## Task List (index)

| # | Task | Size |
|---|---|---|
| 1 | Scaffold: package, config, log, CLI flags | M |
| 2 | Schedule: target time, ISO week, date labels | S |
| 3 | Dashboard API client (items, runs) | S |
| 4 | Grouping: Claude (structured output) + validation + fallback | M |
| 5 | The sheet's HTML | S |
| 6 | PDF with Chrome, fit to a page, `--dry-run` / `--sample` | M |
| — | **Checkpoint A:** a dry run makes a good one-page PDF | |
| 7 | Printer: reachability, `lp`, completion, cancel (fakes only) | M |
| 8 | Email via `curl` (fake SMTP) + notification fallback | M |
| 9 | State (markers, lock) + the weekly flow | M |
| — | **Checkpoint B:** every branch of the weekly flow tested | |
| 10 | Docs, checklist, final check from a clean clone | S |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Counting a PDF's pages without a PDF library | Med | Read the page tree's `/Count` from Chrome's output; a real-Chrome test proves it on this Mac |
| `dns-sd` never exits by itself | Med | Run it with a 3-second timeout and look for "can be reached at" (checked by hand on this Mac) |
| Something actually prints or emails during development | High | Effects are injected and tests only use fakes; Phase 2 runs only `--dry-run`/`--sample`; the real command paths run only from `weekly.ts` |
| SDK request shape drift (structured outputs, fallbacks) | Med | Follow the bundled Claude API skill; a fake Anthropic server test runs the real SDK and checks the request it sends |
| DST changes around Sunday 09:00 | Low | Local-time math through `Date` with local setters; tests cover both DST weekends |

## Open Questions

None blocking. Assumptions are listed in the spec and in the checklist in `docs/STATUS.md`.
