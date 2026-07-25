# Contributing

## Setup

See the [README Quickstart](README.md#quickstart-local-dev). Node 22.6+ (`.nvmrc` = 22.12).

## Workflow

- Branch off `main` (`feat/…`, `fix/…`, `chore/…`). Never commit straight to `main`.
- Before opening a PR, run the same gates CI runs:
  ```bash
  npm run design:check   # design tokens ↔ generated CSS/JS/DESIGN.md are in sync
  npm test               # Vitest suite
  npm run build          # every route compiles
  ```
- Deploy is push-to-`main` → Vercel builds production. Preview builds gate PRs.

## Two things that will bite you

1. **Design tokens are generated.** `src/styles/generated/tokens.css`, `src/lib/generated/tokens.ts`,
   and `DESIGN.md` are emitted from `design/tokens.ts` by `npm run design`. Edit the source, run
   `design`, commit both. `design:check` (in `build` and CI) fails on drift.
2. **DB migrations are manual and ordered.** Add a column to `db/schema.ts` → `npm run db:generate`
   → apply to the target DB with `npm run db:migrate` → confirm it landed → **only then** merge the
   code that reads it. `db.query.*` selects every declared column, so schema-ahead-of-DB = 500s in
   production. Expand-migrate-contract, always.

## Tests

Vitest (`test/`) mocks `@/db` and `@/auth`; jsdom for components (`createRoot` + `act`, no RTL).
Playwright e2e lives behind `npm run e2e`. Add tests with the change, not after.
