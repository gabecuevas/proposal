# CI Runbook

## Workflows

- `CI` (`.github/workflows/ci.yml`)
  - install + Prisma generate
  - migration safety check (PR only)
  - migrate deploy + seed
  - doctor connectivity check
  - lint + typecheck + tests + build

- `API Smoke` (`.github/workflows/api-smoke.yml`)
  - run full document lifecycle smoke using Playwright
  - includes auth/signing/finalize/audit/replay assertions

## Migration Safety Rules

- If `packages/db/prisma/schema.prisma` changes in a PR, a migration file under `packages/db/prisma/migrations/*/migration.sql` must be included.
- CI fails the PR if schema changes are not accompanied by a migration.

## Local CI Dry Run

Run this before opening a PR:

```bash
pnpm --filter @repo/db prisma:generate
pnpm --filter @repo/db prisma:deploy
pnpm --filter @repo/db seed
pnpm doctor
pnpm ci:quality
```

Run smoke flow locally:

```bash
pnpm ci:smoke
```
