# Tasks: `printer` (Phase 2)

Spec: `spec/SPEC-printer.md` · Plan: `tasks/plan.md`

All commands run from `apps/printer/`. "Standard checks" = `npm test` · `npm run typecheck` · `npm run build`.
Never print or email in this phase: only fakes, `--dry-run` and `--sample`.

---

- [x] **Task 1: Scaffold, config, log, CLI flags**

  **Description:** `apps/printer` as a standalone ESM package that Node 24 runs as TypeScript directly. `config.ts` loads `.env` (`process.loadEnvFile`), applies defaults, and reports what's missing for a real run. `log.ts` appends timestamped lines to the log file. `weekly.ts` parses `--dry-run`, `--force`, `--sample`, `--help`.

  **Acceptance criteria:**
  - Defaults match the spec; `PRINT_DAY`/`PRINT_TIME`/`NOTIFY_TO` are validated (one address only).
  - Missing real-run settings are listed by name, never with their values.
  - `node src/weekly.ts --help` prints usage.

  **Verification:** standard checks (`test/config.test.ts`, `test/log.test.ts`).

  **Files:** `package.json`, `tsconfig.json`, `.env.example`, `src/config.ts`, `src/log.ts`, `src/weekly.ts`, tests

---

- [x] **Task 2: Schedule**

  **Description:** Pure functions for the most recent target time ≤ now, the ISO week of a date, the header's date range, and the footer's print date.

  **Acceptance criteria:**
  - Sunday 08:59 targets the previous Sunday; 09:00 targets the same day; Monday catches up to Sunday.
  - ISO weeks are right across year ends: 2026-12-27 → 2026-W52, and 2027-01-03 → 2026-W53 (2026 starts on a Thursday, so it has 53 weeks).
  - Both DST weekends keep 09:00 local.

  **Verification:** standard checks (`test/schedule.test.ts`).

  **Files:** `src/schedule.ts`, `test/schedule.test.ts`

---

- [x] **Task 3: Dashboard API client**

  **Description:** `getActiveItems` and `recordRun` with the bearer token, a timeout, and clear errors (401, 503, network).

  **Acceptance criteria:** items come back typed; a run posts the spec's body; failures carry a short reason with no token in it.

  **Verification:** standard checks (`test/api.test.ts` against a local fake server).

  **Files:** `src/api.ts`, `test/api.test.ts`, `test/fakes.ts`

---

- [x] **Task 4: Grouping**

  **Description:** `groupItems` calls Claude through `@anthropic-ai/sdk` (`claude-sonnet-5-5`, JSON-schema output, `fallbacks: "default"`), validates the answer, and otherwise uses the fallback grouping. Then it orders the groups (largest first) and the items (pinned first, then the API order).

  **Acceptance criteria:**
  - A valid answer is used.
  - Each of these falls back: unknown, missing or duplicate ids; an empty or too-long heading; bad JSON; a refusal; `max_tokens`; an HTTP error; no key.
  - Item text is sent inside a delimited data block with `<` escaped.
  - No item text appears in logs.

  **Verification:** standard checks (`test/group.test.ts`, with a fake Anthropic server running the real SDK).

  **Files:** `package.json` (SDK), `src/group.ts`, `test/group.test.ts`, `test/fakes.ts`

---

- [ ] **Task 5: The sheet's HTML**

  **Description:** `renderSheet(groups, labels, fit)` gives the full HTML per `docs/PRINT_LAYOUT.md`: Letter, 0.75in margins, black and white, Charter, header, groups with rules, ★ for pinned, footer.

  **Acceptance criteria:** text is escaped; group and item order are kept; the one-list fallback has no heading; the fit levels change spacing first, then size (never below 10pt).

  **Verification:** standard checks (`test/render.test.ts`).

  **Files:** `src/render.ts`, `test/render.test.ts`

---

- [ ] **Task 6: PDF and the dry run**

  **Description:** `makePdf` runs the installed Chrome headless (a throwaway profile) to print the HTML to PDF, counts the pages, and tries the fit levels until it fits one page (or the fewest, up to two). `--dry-run` (and `--sample`) go from items to `out/weekly-<Sunday>.pdf`.

  **Acceptance criteria:**
  - A real-Chrome test gets one page for a normal list and two for a very long one (skipped if Chrome is missing).
  - `npm run dry-run -- --sample` writes a PDF that looks right.

  **Verification:** standard checks; dry run with `--sample` and against the local `wrangler dev`; inspect the PDF as an image.

  **Files:** `src/pdf.ts`, `src/run.ts`, `src/weekly.ts`, `test/pdf.test.ts`

---

### Checkpoint A: after Tasks 1–6
- [ ] Standard checks pass
- [ ] A dry run makes a one-page PDF that matches `docs/PRINT_LAYOUT.md`

---

- [ ] **Task 7: Printer**

  **Description:** `isReachable` (`lpstat -p` enabled, plus a 3-second `dns-sd -L` lookup of the queue's Bonjour name, read from `lpstat -v`), `printPdf` (`lp -d … -o media=Letter`), then wait until the job leaves `lpstat -W not-completed`; if 5 minutes pass, `cancel` it and fail.

  **Acceptance criteria:** each branch is tested with a fake command runner (enabled/disabled, Bonjour found or not, job completes, times out and is cancelled, `lp` error). Nothing is printed.

  **Verification:** standard checks (`test/printer.test.ts`).

  **Files:** `src/printer.ts`, `src/run.ts`, `test/printer.test.ts`

---

- [ ] **Task 8: Email and notification**

  **Description:** `buildMessage` makes a MIME multipart message (text plus the PDF, base64). `sendEmail` runs `curl` against SMTPS, with the credentials on stdin and the message in a private temp file. `notify` shows a macOS notification, with its text passed as arguments rather than script.

  **Acceptance criteria:**
  - The message parses (headers, boundary, attachment).
  - The real `curl` delivers it to a local fake SMTP server.
  - A send failure is reported.
  - `notify` builds the right `osascript` call.

  **Verification:** standard checks (`test/email.test.ts`, `test/notify.test.ts`).

  **Files:** `src/email.ts`, `src/notify.ts`, `test/email.test.ts`, `test/notify.test.ts`, `test/fakes.ts`

---

- [ ] **Task 9: State and the weekly flow**

  **Description:** `state.ts` handles the done markers per week and a lock that recovers if left stale. `job.ts` runs the spec's weekly flow over injected effects. `weekly.ts` wires up the real ones and sets exit codes.

  **Acceptance criteria:** tests move the clock through every branch:
  - already done; first run after the target; catch-up on Monday;
  - unreachable within 24h (retry), then after 24h (email only);
  - no items; Claude failing (fallback);
  - email failing (notification, and `failed` recorded); recording the run failing (logged only);
  - a lock that's held, or stale;
  - `--force`.

  **Verification:** standard checks (`test/state.test.ts`, `test/job.test.ts`).

  **Files:** `src/state.ts`, `src/job.ts`, `src/weekly.ts`, `test/state.test.ts`, `test/job.test.ts`

---

### Checkpoint B: after Tasks 7–9
- [ ] Standard checks pass
- [ ] Every branch of the spec's weekly flow is covered by a test

---

- [ ] **Task 10: Docs and final check**

  **Description:** Write `apps/printer/CLAUDE.md`, the root `CLAUDE.md` commands, the `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` updates, and `docs/STATUS.md` with Mattan's checklist. Then check the spec's success criteria from a clean clone.

  **Acceptance criteria:** every success criterion in the spec holds; the checklist lists every input and action needed from Mattan.

  **Verification:** a clean clone (`npm ci`, tests, typecheck, `npm run dry-run -- --sample`).

  **Files:** `apps/printer/CLAUDE.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`

---

### Checkpoint C: Phase 2 complete
- [ ] All spec success criteria met
- [ ] Checklist for Mattan is complete
