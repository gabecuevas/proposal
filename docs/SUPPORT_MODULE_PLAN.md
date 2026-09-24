# SendDox platform support module — implementation plan

Branch: `feature/platform-support-module`  
Baseline: `pnpm ci:quality` green on main (2026-09-24). Pre-existing turbo “no output files” warnings for packages are unrelated.

## Goals

Platform-admin Contacts, Inbox, Messenger, Messages (campaigns), and email continuity for SendDox customer support. Not customer-to-customer CRM.

## Permission model

- Add `User.is_platform_admin` (boolean, default false). Workspace `OWNER`/`ADMIN`/`MEMBER` never imply platform access.
- Provision via `PLATFORM_ADMIN_EMAILS` (comma-separated) checked at boot/login to sync the flag, plus explicit SQL/docs for one-off grants.
- Enforce on every `/admin/*` page and `/api/admin/*` / support customer APIs.

## Feature flags (env, server-enforced, default off)

| Flag | Purpose |
| --- | --- |
| `SUPPORT_ADMIN_ENABLED` | Admin Contacts + Inbox UI/API |
| `SUPPORT_MESSENGER_ENABLED` | Customer messenger widget |
| `SUPPORT_CAMPAIGNS_ENABLED` | Targeted in-app messages |
| `SUPPORT_EMAIL_ENABLED` | Outbound unread notifications + inbound reply processing |

Disabled flags: no polling, no outbound support email, admin routes 404/403.

## Routes

| Route | Role |
| --- | --- |
| `/admin` | Redirect to contacts |
| `/admin/contacts` | Contact table + detail |
| `/admin/inbox` | Support inbox |
| `/admin/messages` | Campaigns |
| `/api/admin/**` | Platform APIs |
| `/api/support/**` | Authenticated customer messenger APIs |
| `/api/webhooks/resend/support` | Inbound/delivery webhook (signature verified) |
| `/api/cron/support-jobs` | Authenticated job runner |

## Data model (additive)

- Activity: `User.last_login_at`, `User.last_active_at`, `User.tracked_since`, `User.city`, `User.city_source`, `User.timezone_source`, `ActivitySession`
- Support: `SupportConversation`, `SupportMessage`, `SupportReadState`, `SupportContactNote`, `SupportReplyToken`
- Campaigns: `SavedAudience`, `InAppCampaign`, `CampaignDelivery`
- Jobs: `SupportJob` (durable outbox-style claims)
- Audit: `SupportAuditEvent`

## Background processing

- Prefer existing Redis/BullMQ worker with a new `support-jobs` queue when `REDIS_URL` is set.
- Always write `SupportJob` rows in the same transaction as the triggering write.
- Fallback: authenticated cron `POST /api/cron/support-jobs` with `CRON_SECRET` for serverless hosts without a worker.
- Default unread-email delay: 120s (configurable `SUPPORT_EMAIL_DELAY_SECONDS`).

## External config

- Existing: `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `NEXT_PUBLIC_APP_URL`
- New: feature flags above, `PLATFORM_ADMIN_EMAILS`, `CRON_SECRET`, `RESEND_SUPPORT_WEBHOOK_SECRET`, `SUPPORT_REPLY_DOMAIN` (e.g. `reply.senddox.com`)

## Phases

1. Foundation: flags, admin gate, schema, contacts, tracking  
2. Chat + inbox + messenger  
3. Email continuity  
4. Campaigns  
5. Tests + rollout docs  

## Acceptance (summary)

See parent prompt §15. Live Resend inbound DNS is externally blocked until configured; chat/inbox remain functional without it.
