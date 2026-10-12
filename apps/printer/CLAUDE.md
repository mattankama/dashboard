# apps/printer

The Mac's weekly job: fetch the active items, group them (Claude, or the fallback), render the sheet, make the PDF with Chrome, print it, email it. Spec: `spec/SPEC-printer.md`. Sheet layout: `docs/PRINT_LAYOUT.md`.

## Commands (run here)

```
npm install
cp .env.example .env            # placeholders work for dry runs against the local web app
npm run dry-run                 # out/weekly-<Sunday>.pdf from the API in .env
npm run dry-run -- --sample     # same, with built-in example items (no API needed)
npm test                        # node --test; TZ pinned to America/Los_Angeles
npm run typecheck               # tsc --noEmit (also `npm run build`; there's no build step)
npm run weekly                  # the real run: prints and emails when due (Phase 3 schedules it)
```

**A real print or a real email needs Mattan's OK first** (`CLAUDE.md`). `npm run weekly` does both when the week is due, and `--force` makes it do them even when the week is done.

## Layout

- `src/weekly.ts`: the CLI. It wires real effects into `job.ts` (real runs) or `sheet.ts` (dry runs).
- `src/job.ts`: every weekly decision, over injected effects. Change behaviour here, test it in `test/job.test.ts`.
- `src/group.ts`: Claude grouping (`claude-sonnet-5-5`, JSON-schema output, `fallbacks: "default"`), its checks, and the fallback.
- `src/render.ts` → `src/pdf.ts`: HTML for the sheet, then Chrome to PDF, fitted to a page.
- `src/printer.ts`, `src/email.ts`, `src/notify.ts`: `lp`/`lpstat`/`cancel`/`dns-sd`, `curl` SMTPS, `osascript`.
- `src/state.ts`: `~/Library/Application Support/dashboard/` (done markers, alerts, sheets, lock, `last-run`). The log is `~/Library/Logs/dashboard.log`.

## Gotchas

- **Node runs the `.ts` files directly** (type stripping). Only erasable syntax works: no enums, namespaces or parameter properties. Relative imports end in `.ts`.
- **Every outside command goes through a `Runner`** (`src/run.ts`). Tests pass fakes, so they never print, email or notify. Keep it that way.
- **Chrome 154 doesn't exit after `--print-to-pdf` when it has its own profile.** `pdf.ts` waits for the finished file (`%%EOF`, no longer growing), then stops Chrome.
- **`dns-sd` never exits.** It gets 3 seconds, then its output is read. So `printerStatus` takes about 3 seconds.
- **Claude only groups** (`CLAUDE.md`). Its answer is used only if every id appears exactly once with short headings; otherwise the fallback. Item text never goes in logs or email bodies.
- **Fit levels were measured** with Charter on this Mac: about 26 one-line items fit a page at the roomiest level, and about 40 at 10pt (`test/pdf.test.ts`).
