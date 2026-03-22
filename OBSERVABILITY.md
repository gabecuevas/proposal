# Observability Guide

This document defines structured logging conventions and starter alert thresholds.

## Structured Logging

- Web logs are emitted as JSON from `apps/web/lib/observability/logger.ts`.
- Worker logs are emitted as JSON from `apps/worker/src/logger.ts`.
- Required correlation keys:
  - `requestId` for API logs
  - `correlationId` for background jobs and webhook deliveries

Example web log:

```json
{"ts":"2026-03-13T12:00:00.000Z","level":"info","service":"web","event":"api.response","requestId":"...","method":"GET","path":"/api/audit/activity","status":200}
```

Example worker log:

```json
{"ts":"2026-03-13T12:00:00.000Z","level":"warn","service":"worker","event":"webhook.delivery_non_2xx","deliveryId":"...","statusCode":500,"deadLetter":false,"correlationId":"..."}
```

## Health and Readiness Endpoints

- Web:
  - `GET /api/health`
  - `GET /api/ready` (checks DB + Redis)
- Worker (when `WORKER_HEALTH_PORT` is set):
  - `GET /health`
  - `GET /ready` (checks worker loops are running)

## Starter Alert Thresholds

### Webhook Dead Letters

- **Signal**: `webhook_delivery_dead_letter_count_5m`
- **Rule**: alert when count >= 5 over 5 minutes (warning), >= 20 (critical)

Suggested query:

```sql
select count(*) as dead_letters_5m
from "WebhookDelivery"
where status = 'DEAD_LETTER'
  and updated_at >= now() - interval '5 minutes';
```

### PDF Job Failures

- **Signal**: `pdf_job_queue_failed_count_5m`
- **Rule**: alert when count >= 3 over 5 minutes (warning), >= 10 (critical)

Suggested query:

```sql
select count(*) as pdf_queue_failed_5m
from "DocumentActivityEvent"
where event_type = 'DOCUMENT_PDF_JOB_QUEUE_FAILED'
  and created_at >= now() - interval '5 minutes';
```

### Web Readiness Degradation

- **Signal**: `/api/ready` non-200 ratio
- **Rule**: alert when non-200 >= 20% for 5 minutes

### Worker Readiness Degradation

- **Signal**: `/ready` non-200 from worker probe
- **Rule**: alert on 3 consecutive failed checks
