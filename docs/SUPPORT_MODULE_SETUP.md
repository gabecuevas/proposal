# Platform support module — setup, rollout, rollback

See also: [SUPPORT_MODULE_PLAN.md](./SUPPORT_MODULE_PLAN.md), [SUPPORT_MODULE_COMPLETION.md](./SUPPORT_MODULE_COMPLETION.md).

## Safe apply order

1. Deploy code with all `SUPPORT_*` flags **false** (default).
2. Apply migration on the target DB:
   ```bash
   pnpm --filter @repo/db prisma:deploy
   ```
   Migration: `20260924130000_platform_support_module`
3. Set `PLATFORM_ADMIN_EMAILS=you@yourdomain.com` (or SQL: `UPDATE "User" SET is_platform_admin = true WHERE email = '…';`).
4. Enable flags in order:
   1. `SUPPORT_ADMIN_ENABLED=true` → verify `/admin/contacts` and `/admin/inbox`
   2. `SUPPORT_MESSENGER_ENABLED=true` → verify widget on `/app`
   3. `SUPPORT_CAMPAIGNS_ENABLED=true` → verify `/admin/messages`
   4. `SUPPORT_EMAIL_ENABLED=true` only after Resend + reply DNS + webhook are ready
5. Schedule job runner:
   - `POST /api/cron/support-jobs` with header `Authorization: Bearer $CRON_SECRET` every 1–2 minutes

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPPORT_ADMIN_ENABLED` | Platform Contacts + Inbox |
| `SUPPORT_MESSENGER_ENABLED` | Customer messenger |
| `SUPPORT_CAMPAIGNS_ENABLED` | In-app campaigns |
| `SUPPORT_EMAIL_ENABLED` | Unread email notify + inbound replies |
| `SUPPORT_EMAIL_DELAY_SECONDS` | Default `120` |
| `SUPPORT_REPLY_DOMAIN` | e.g. `reply.senddox.com` |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated emails synced to `is_platform_admin` on login |
| `CRON_SECRET` | Cron job auth |
| `RESEND_SUPPORT_WEBHOOK_SECRET` | Svix `whsec_…` webhook signing secret |
| Existing | `RESEND_API_KEY`, `MAIL_FROM_ADDRESS`, `NEXT_PUBLIC_APP_URL` |

## Resend receiving domain (do not invent DNS values)

1. In Resend, add receiving domain `reply.senddox.com` (or your chosen subdomain).
2. Copy the **exact** MX/TXT records Resend shows into DNS (separate from `mail.senddox.com` sending).
3. Create webhook → `https://www.senddox.com/api/webhooks/resend/support` for `email.received`.
4. Set `RESEND_SUPPORT_WEBHOOK_SECRET` from the webhook signing secret (`whsec_…`).
5. Set `SUPPORT_REPLY_DOMAIN=reply.senddox.com`.
6. Reply-To addresses look like `reply+<opaque-token>@reply.senddox.com`.

Until this is done: chat and inbox work; outbound unread emails stay queued/suppressed visibly — never claim delivered.

Webhook verification uses Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`) over the **raw** body. Email HTML/text is fetched via `GET https://api.resend.com/emails/receiving/{email_id}` (not present in the webhook payload).

## Rollback

1. Set all `SUPPORT_*` flags to `false` and redeploy (stops new UI, polling, and outbound notifies).
2. Pause cron / worker claims on `SupportJob`.
3. Do **not** drop tables or delete `SupportConversation` / `SupportMessage` rows.
4. Keep accepting webhooks if in-flight emails may still arrive; with `SUPPORT_EMAIL_ENABLED=false`, handlers acknowledge without mutating product auth flows.

## Assigning platform admin

Preferred: `PLATFORM_ADMIN_EMAILS=you@senddox.com` then log in once (sync runs on login).

Manual:

```sql
UPDATE "User" SET is_platform_admin = true WHERE email = 'you@senddox.com';
```

Workspace Owner/Admin roles never grant platform access.
