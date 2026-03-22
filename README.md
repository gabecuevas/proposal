# Proposal Monorepo

Full-stack SaaS proposal/document platform with templates, editor JSON model, signing flow, PDF finalization, API keys, webhooks, and audit endpoints.

## Monorepo Structure

- `apps/web`: Next.js web app and API routes
- `apps/worker`: BullMQ worker for PDF and webhook jobs
- `packages/db`: Prisma schema, migrations, seed, DB client
- `packages/shared`: shared types/contracts
- `packages/ui`: shared UI components

## Prerequisites

- Node.js 18+
- pnpm 9
- Docker (for local Postgres/Redis)

## Local Setup

1. Start infrastructure:

```bash
docker compose up -d postgres redis
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure env:

```bash
cp .env.example .env
```

4. Validate connectivity and env:

```bash
pnpm doctor
```

5. Apply migrations and seed:

```bash
pnpm --filter @repo/db prisma:deploy
pnpm --filter @repo/db seed
```

6. Start apps:

```bash
pnpm --filter web dev
pnpm --filter @repo/worker dev
```

## Quality Gates

```bash
pnpm ci:quality
```

This runs lint, typecheck, tests, and build across the monorepo.

## Smoke Test

```bash
pnpm ci:smoke
```

Runs the Playwright document lifecycle smoke flow.

## CI/CD

- CI workflow: `.github/workflows/ci.yml`
- API smoke workflow: `.github/workflows/api-smoke.yml`
- CI operations guide: `CI_RUNBOOK.md`
- Deployment runbook: `DEPLOYMENT_RUNBOOK.md`
- Observability guide: `OBSERVABILITY.md`
