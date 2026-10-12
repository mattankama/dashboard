# Current status

_Last updated: 2026-10-11_

## Phase

**1: `apps/web`, planned and not started.** No app code yet. The setup is committed and pushed to `https://github.com/mattankama/dashboard` (private), on branch `main`, which tracks `origin/main`.

## Done

- Product context, architecture, print layout and decision log written (`docs/`).
- Confirmed the printer works from this Mac: CUPS queue `CanonMF4800` is the default printer, reached over Wi-Fi with AirPrint. No test page has been printed yet.
- Engineering skills installed in `.agents/skills/` and linked into `.claude/skills/`.
- Phase 1 spec approved: `spec/SPEC-web.md` (moved from `docs/` so upstream `/build auto` can find it; added `npm run build` = `wrangler deploy --dry-run`).
- `apps/web/package.json` created and dev tools installed (wrangler 4.149.0, typescript 7.0.2, vitest 4.1.11, @cloudflare/vitest-pool-workers 0.23.0, @cloudflare/workers-types). npm 12 blocked their install scripts, but the workerd and esbuild binaries run anyway. `npm audit` reports 5 high-severity issues in sharp and undici, which come in through wrangler/miniflare; they're local dev tools only and nothing ships.

## Next task

**Phase 1: `apps/web`.** Plan written (`tasks/plan.md`, `tasks/todo.md`: 11 tasks, 3 checkpoints). **Wait for Mattan to say when to start building**, then `/build` begins with Task 1. UI design decisions are in `docs/UI.md`; Task 4 starts by asking Mattan its open questions.

After that:
- Phase 2: `apps/printer` with `--dry-run`.
- Phase 3: launchd install.
- Phase 4: deploy, then Cloudflare Access, then the first real weekly run.

## Needed from Mattan before deploying

- A Cloudflare account
- An Anthropic API key
- A Gmail app password, plus the address to notify

## Open questions

- Print day and time (default: Sunday 09:00).
- Starting categories (e.g. School, Personal, Ideas, People), or none at all and let Claude group items.
- Do items expire after N weeks, or does Mattan archive them by hand?

## Notes for the next session

- Commits go to `origin` (`github.com/mattankama/dashboard`, private). The skills in `.agents/` are committed.

- **Skills fixed (2026-10-11):** `.agents/skills/` had gone missing, which broke every link in `.claude/skills/`. Restored all 25 with `npx skills experimental_install`; `skills-lock.json` is unchanged. `npx skills` doesn't install the upstream commands (`/spec`, `/plan`, …). `/build` was copied from upstream `.claude/commands/build.md`, with only the plugin prefix `agent-skills:` removed from skill names so they resolve here. It commits after every task, and `/build auto` only finds specs under `spec/`, `SPEC.md` or `docs/SPEC.md`, which is why the spec now lives in `spec/`.

- When `apps/web` and `apps/printer` exist, give each its own short `CLAUDE.md` with that app's commands and gotchas, and add their commands to the root `CLAUDE.md`.
