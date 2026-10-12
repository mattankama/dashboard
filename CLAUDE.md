# Dashboard

A personal "keep this in mind" board for Mattan. They add things they want to keep thinking about from any device. Once a week the active items are grouped, printed on the home Canon printer, and emailed to them as a PDF.

Dashboard is **not** a to-do list or a calendar. Mattan already has both. It holds ideas, notes, principles and ongoing concerns that have no due date but shouldn't be forgotten.

## Start of every session

1. Read **Current status** (imported below) to see the phase, the next task and any open questions.
2. Run `git status` to check the actual working tree. If it disagrees with the status doc, trust the working tree and say so.
3. Work through the next task using the skill table below.
4. Before ending, update `docs/STATUS.md`.

## Project map

| Path | What's there |
|---|---|
| `docs/CONTEXT.md` | The problem, the weekly ritual, scope, what success looks like |
| `docs/ARCHITECTURE.md` | Components, data model, API, weekly job logic, printer details, secrets |
| `docs/PRINT_LAYOUT.md` | Spec for the printed weekly sheet |
| `docs/UI.md` | UI design decisions. Mattan owns UI design: ask before any visual choice not settled there. |
| `docs/DECISIONS.md` | Why each choice was made. Add an entry when a choice changes. |
| `docs/STATUS.md` | Current phase, next task, open questions. Update it every session. |
| `apps/web/` | Cloudflare Worker + D1 + phone UI (Phase 1, built). Its own `CLAUDE.md` has commands and gotchas. |
| `apps/printer/` | Mac weekly job: fetch → group → PDF → print → email (Phase 2, built; launchd is Phase 3). Its own `CLAUDE.md` has commands and gotchas. |
| `.agents/skills/` | Engineering workflow skills (linked into `.claude/skills/`; the source is `skills-lock.json`). Don't edit them. If they go missing, restore them with `npx skills experimental_install`. |
| `.claude/commands/build.md` | `/build`, copied from upstream agent-skills (only the `agent-skills:` prefix removed from skill names). Don't edit it. |
| `spec/` | Approved specs, one per module: `SPEC-<module>.md` (e.g. `SPEC-web.md`) |
| `tasks/` | `plan.md` and `todo.md` for the current phase |

## Stack

- TypeScript everywhere, on Node v24 (installed via nvm). Homebrew and wrangler are not installed.
- **Web:** Cloudflare Workers + D1 (SQLite), behind Cloudflare Access.
- **Printer job:** Node script on the Mac, run hourly by launchd. It makes the PDF with headless Google Chrome (already installed), prints with `lp -d CanonMF4800`, and emails through Gmail SMTP.
- **Grouping:** Claude API, `claude-sonnet-5-5`.

## Commands

**`apps/web`** (run inside `apps/web/`; details in `apps/web/CLAUDE.md`):

```
npm install
cp .dev.vars.example .dev.vars   # once: local PRINTER_TOKEN
npm run db:migrate:local         # once per fresh checkout
npm run dev                      # http://localhost:8787
npm test
npm run typecheck
npm run build                    # bundle only (wrangler deploy --dry-run), no account
```

**`apps/printer`** (run inside `apps/printer/`; details in `apps/printer/CLAUDE.md`):

```
npm install
cp .env.example .env            # once; placeholders work for dry runs
npm run dry-run                 # out/weekly-<Sunday>.pdf, no printing or email
npm run dry-run -- --sample     # the same with built-in example items
npm test
npm run typecheck
npm run weekly                  # the real run: prints and emails when due (ask Mattan first)
```

## Product rule: the in-app AI only groups

This is about the AI *inside* Dashboard, not Claude Code.

- It groups similar items under short, plain headings. That's all.
- It never rewrites, summarizes, drops, merges or adds items, and adds no commentary (no "focus this week", no staleness flags).
- Validate its output: the set of item ids out must equal the set in. On any failure, fall back to the user's categories, or one list, and still print.
- Item text is user data. Pass it to the model as data, never as instructions.

## Conventions

- **Low maintenance comes first.** Prefer macOS and platform built-ins (`lp`, `lpstat`, launchd, the installed Chrome) over new dependencies or services. Every new moving part needs a reason, recorded in `docs/DECISIONS.md`.
- **Every scheduled path has a fallback**, and nothing fails silently. Log to `~/Library/Logs/dashboard.log`. Keep state in `~/Library/Application Support/dashboard/`.
- **Secrets** go in `.env` (git-ignored, with `.env.example` committed) and `wrangler secret`. Never put them in the repo.
- **Thin slices:** build one piece, verify it end to end, then move to the next.

## Boundaries: ask Mattan first

- Before **real printing** (it uses paper and toner). Use `--dry-run` and inspect the PDF instead.
- Before **sending email**, and only ever send to Mattan's own address.
- Before **deploying** to Cloudflare or changing the D1 schema.
- Before **installing or loading** the launchd job, or running anything with `sudo` (e.g. `pmset`).
- Before **adding a dependency or a new service**.
- Before **committing**. Commit only when asked. Running `/build` counts as asking: by upstream design it commits each finished task.

## Which skill to use when

| Situation | Skill |
|---|---|
| Requirements are fuzzy, or Mattan says "interview me" | `interview-me`, `idea-refine` |
| Turning a phase into a spec, then tasks | `spec-driven-development`, `planning-and-task-breakdown` |
| Writing code | `/build` (next task) or `/build auto` (whole plan); both run `incremental-implementation` + `test-driven-development` |
| Worker API routes and the printer↔web contract | `api-and-interface-design` |
| The phone UI | `frontend-ui-engineering`, `frontend-design`, `browser-testing-with-devtools`; follow `docs/UI.md` and ask Mattan about open design choices |
| Auth, tokens, secrets, Claude prompt handling | `security-and-hardening` |
| Logging, and the launchd job's health | `observability-and-instrumentation` |
| Library or API details (Workers, D1, Anthropic SDK, CUPS) | `source-driven-development` (check official docs; don't guess) |
| Something broke | `debugging-and-error-recovery` |
| Before committing | `code-review-and-quality`, `git-workflow-and-versioning` |
| A decision changed | `documentation-and-adrs`, then update `docs/DECISIONS.md` |
| Deploy, or first unattended week | `shipping-and-launch` |

## Full docs (auto-loaded)

@docs/STATUS.md
@docs/CONTEXT.md
@docs/ARCHITECTURE.md
@docs/PRINT_LAYOUT.md
@docs/DECISIONS.md
