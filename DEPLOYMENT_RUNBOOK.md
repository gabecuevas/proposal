# Deployment Runbook

This runbook documents staging and production deploy steps for the Proposal monorepo.

## Deployment Topology

- `apps/web`: Next.js app (recommended host: Vercel)
- `apps/worker`: BullMQ worker for PDF/webhook jobs (recommended host: Fly.io or Render)
- `packages/db`: Prisma schema, migrations, and seed
- Runtime dependencies: PostgreSQL + Redis

## Environment Verification Checklist

Use this checklist before every deploy:

- [ ] `DATABASE_URL` points to the target environment database
- [ ] `REDIS_URL` points to the target environment Redis
- [ ] `AUTH_SECRET` is set and non-default
- [ ] `NEXTAUTH_URL` points to public app URL
- [ ] `NEXT_PUBLIC_APP_URL` points to public app URL
- [ ] `S3_ENDPOINT` and `S3_BUCKET` are reachable from runtime
- [ ] `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` are valid
- [ ] `pnpm doctor` succeeds with target env values

## Staging Deploy Procedure

1. Trigger CI and ensure green:
   - `pnpm ci:quality`
   - API smoke workflow succeeds (`API Smoke`)
2. Apply DB migrations:
   - `pnpm --filter @repo/db prisma:deploy`
3. Optional: reseed staging demo data:
   - `pnpm --filter @repo/db seed`
4. Deploy web (`apps/web`) to staging target.
5. Deploy worker (`apps/worker`) to staging target.
6. Run smoke verification:
   - Sign up a user
   - Create template and document
   - Send, sign, finalize flow
   - Check `/api/audit/activity` and `/api/audit/webhook-deliveries`
7. Confirm logs contain request/correlation IDs.

## Production Deploy Procedure

1. Confirm staging passed and no open incident.
2. Freeze merges during migration/deploy window.
3. Apply migrations first:
   - `pnpm --filter @repo/db prisma:deploy`
4. Deploy `apps/web`.
5. Deploy `apps/worker`.
6. Execute production smoke:
   - Auth login API
   - Document send/finalize API
   - Webhook replay endpoint (non-destructive test ID)
   - Audit list endpoints with pagination
7. Monitor error rate and queue backlog for 15-30 minutes.

## Rollback Procedure

- Web rollback:
  - Roll back to previous web release in hosting provider.
- Worker rollback:
  - Roll back worker image/revision.
- DB rollback:
  - Prefer forward-fix migration.
  - If emergency DB rollback is required, execute manual SQL rollback only with approved runbook and backup confirmation.
- After rollback:
  - Re-run API smoke checks and verify queue processing.

## Incident Triage Quick Checks

- `DOCUMENT_PDF_JOB_QUEUE_FAILED` activity events spike
- `webhookDelivery` rows accumulating in `DEAD_LETTER`
- Redis connectivity and queue worker health
- Missing `x-request-id` in API responses/log traces
