# Platform support module — completion report

Branch: `feature/platform-support-module`  
Date: 2026-09-24  
Status: Implemented on branch; **not** deployed; production migration **not** applied.

## 1. Implemented behavior

### Contacts (`SUPPORT_ADMIN_ENABLED`)
- `/admin/contacts` lists real users with name, email, company (from membership), user type (Account Owner / User), signup date, session count (with “Tracked since”), last login, last active, city/timezone (Unknown when absent), email verification.
- Server-side search (name, email, company), pagination, CSV export with formula-injection protection and audit event.
- Contact detail drawer: memberships (role + account size per workspace), conversations, campaign deliveries.
- Platform admin gate: `User.is_platform_admin` + `PLATFORM_ADMIN_EMAILS` sync; workspace Owner/Admin never grants access.

### Activity tracking
- `recordSuccessfulLogin` hooked into email + Google login success paths.
- `recordMeaningfulActivity` with 30-minute session gap and 1-minute write throttle.
- No fabricated historical sessions; missing history shown as Not tracked / Tracked since.

### Inbox + Messenger (`SUPPORT_ADMIN_ENABLED` / `SUPPORT_MESSENGER_ENABLED`)
- Admin inbox: filters, thread, public reply vs internal note, assign/status, unread.
- Customer messenger widget (lazy-loaded) on authenticated app shell; polling ~30s badge / ~5s when open; pauses when tab hidden.
- Internal notes filtered at serialization for customer viewers.
- Idempotent sends via `client_op_id` uniqueness.
- Customer reply reopens resolved conversations; admin public reply → Waiting on customer.

### Email continuity (`SUPPORT_EMAIL_ENABLED`)
- Admin public reply enqueues durable `SupportJob` (`support.notify_unread`) in the same transaction.
- Job suppresses when already read, unverified recipient, or recent per-conversation email.
- Outbound uses existing mail outbox + Resend adapter with Reply-To `reply+<token>@SUPPORT_REPLY_DOMAIN`.
- Inbound webhook: Svix signature verification, durable event dedupe, fetch body via Resend Receiving API, sender must match verified participant, autoresponder quarantine.
- With email flag off: webhook can still ack (when secret configured) without mutating conversations when disabled after durable accept path; missing secret returns 503.

### Campaigns (`SUPPORT_CAMPAIGNS_ENABLED`)
- Admin Messages table with status tabs and unique delivery/view/click/reply metrics.
- Versioned allowlisted audience filters (AND only); publish snapshots content/rules and enqueues bounded delivery batches.
- Uniqueness: `(campaign_id, user_id, campaign_version)`.
- Customer deliveries API for in-app inbox; pause stops new deliveries.

### Jobs
- `POST /api/cron/support-jobs` with `Authorization: Bearer $CRON_SECRET` claims `SupportJob` rows (lease + retry) and processes mail outbox; also nudges ongoing campaign evaluation.

## 2. Routes and principal files

| Area | Paths |
| --- | --- |
| Admin UI | `apps/web/app/admin/{layout,page,contacts,inbox,messages}/` |
| Admin API | `apps/web/app/api/admin/**` |
| Customer API | `apps/web/app/api/support/**` |
| Webhook / cron | `apps/web/app/api/webhooks/resend/support`, `apps/web/app/api/cron/support-jobs` |
| Domain | `apps/web/lib/support/*` |
| UI | `apps/web/components/support/*` |
| Schema | `packages/db/prisma/schema.prisma`, migration `20260924130000_platform_support_module` |
| Docs | `docs/SUPPORT_MODULE_PLAN.md`, `docs/SUPPORT_MODULE_SETUP.md`, this file |
| Auth hooks | `apps/web/app/api/auth/login`, `apps/web/app/api/auth/google/callback` |

## 3. Schema migration / apply order

1. Deploy code with all `SUPPORT_*` flags **false**.
2. `pnpm --filter @repo/db prisma:deploy` → applies `20260924130000_platform_support_module` (additive only).
3. Set `PLATFORM_ADMIN_EMAILS` (or SQL grant `is_platform_admin`).
4. Enable flags in order: Admin → Messenger → Campaigns → Email (after DNS/webhook).
5. Schedule cron every 1–2 minutes.

`PRISMA_SCHEMA_REV` = 26.

## 4. Environment variables (placeholders only)

```
SUPPORT_ADMIN_ENABLED=false
SUPPORT_MESSENGER_ENABLED=false
SUPPORT_CAMPAIGNS_ENABLED=false
SUPPORT_EMAIL_ENABLED=false
SUPPORT_EMAIL_DELAY_SECONDS=120
SUPPORT_REPLY_DOMAIN=reply.senddox.com
PLATFORM_ADMIN_EMAILS=
CRON_SECRET=
RESEND_SUPPORT_WEBHOOK_SECRET=
# existing
RESEND_API_KEY=
MAIL_FROM_ADDRESS=
NEXT_PUBLIC_APP_URL=
DATABASE_URL=
```

## 5. Resend + receiving-domain setup

1. Keep sending domain (`mail.senddox.com`) unchanged.
2. In Resend, add **receiving** domain `reply.senddox.com` (or chosen subdomain).
3. Copy **exact** MX/TXT values Resend shows into DNS (do not invent).
4. Create webhook → `https://<app-host>/api/webhooks/resend/support` for `email.received` (and delivery events if desired).
5. Set `RESEND_SUPPORT_WEBHOOK_SECRET` to the webhook `whsec_…` signing secret.
6. Set `SUPPORT_REPLY_DOMAIN` to the receiving domain.
7. Enable `SUPPORT_EMAIL_ENABLED` only after 2–6 succeed.

Official docs used: Resend webhook Svix verification; Receiving API `GET /emails/receiving/{email_id}` (body not in webhook payload).

## 6. Worker / scheduler

- Primary path: authenticated cron hitting `/api/cron/support-jobs` every **1–2 minutes**.
- Effective unread-email latency ≈ `SUPPORT_EMAIL_DELAY_SECONDS` (default 120s) **plus** cron interval (so ~2–4 minutes typical).
- Jobs use DB leases; failures remain pending with backoff. Chat works if email/cron is down.

## 7. Test results

| Check | Result |
| --- | --- |
| `tsc --noEmit` (web) | Pass |
| `vitest run lib/support` | **10 passed** (flags, CSV, audience allowlist, webhook HMAC, From parse) |
| ESLint on support paths | Pass |
| Pre-existing turbo “no output files” package warnings | Unrelated; unchanged |

Not yet automated end-to-end against a live DB/mailbox in this branch: full browser inbox round-trip, live Resend receive DNS, production permission matrix. Those remain local/manual or externally blocked.

## 8. Externally blocked verification

- Production Prisma migrate (intentionally not run).
- Live `reply.*` MX / Resend receiving domain verification.
- Live signed webhook round-trip with real inbound mail.
- Full §15 regression suite against staging (signup, Google login, document send, billing) — run before enabling flags in production.

## 9. Feature-flag rollout sequence

1. Migrate DB.
2. `PLATFORM_ADMIN_EMAILS` + login once.
3. `SUPPORT_ADMIN_ENABLED=true` → Contacts + Inbox.
4. `SUPPORT_MESSENGER_ENABLED=true` → widget on `/app`.
5. `SUPPORT_CAMPAIGNS_ENABLED=true` → Messages (use synthetic users only).
6. Configure Resend receiving + webhook + cron.
7. `SUPPORT_EMAIL_ENABLED=true`.

## 10. Rollback

1. Set all `SUPPORT_*` to `false` and redeploy (stops UI, polling, new outbound notify jobs).
2. Pause cron.
3. **Do not** drop tables or delete conversations/messages.
4. Keep webhook secret configured if in-flight emails may arrive; with email flag off, processing skips conversation mutation after durable accept where applicable.

## Known gaps vs full prompt (honest)

- Saved filter groups UI is schema-ready (`SavedAudience`) but not fully exposed as a reusable picker.
- Campaign editor is lightweight (title/body/publish/pause); advanced filter UI is API/schema-backed rather than a full visual builder.
- Rich-text composer is plain text → escaped HTML paragraphs (no TipTap in messenger).
- Attachments intentionally omitted.
- No WebSocket; polling only.
- Marketing-site messenger: show sign-in handoff only if separate origin lacks shared session (document when wiring marketing repo).

## Assign platform admin

```
PLATFORM_ADMIN_EMAILS=you@senddox.com
```

or

```sql
UPDATE "User" SET is_platform_admin = true WHERE email = 'you@senddox.com';
```
