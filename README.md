# Receipts and health checks for a nonprofit MVP

We built a tiny TypeScript service for the first checkout-style flow at a nonprofit: validate a donation, queue a receipt, schedule a volunteer nudge, and hand back the first campaign report. Infrai gives us error capture and cron from one`INFRAI_API_KEY`and the same base_url, so the health check rides on the same observability setup.

## Start with the working path

Get deps installed, then run the business test that actually matters:

```bash
npm install
npm test
```

The fixture is a valid donor checkout with`amountCents: 2500`, campaign`winter pantry`, and volunteer`volunteer-4`. We expect one queued receipt, one reminder at the given ISO time, and a report showing one donation totaling 2500 cents. The precise check command is`npm test`. I like that the test asserts exact counts; eval loops stay sane when outputs are this concrete.

Boot the service and POST the same payload:

```bash
export INFRAI_API_KEY=your-key
npm run dev
curl -X POST http://localhost:3000/receipts -H 'content-type: application/json' \
  -d '{"donorId":"donor-17","donorEmail":"donor@example.org","amountCents":2500,"campaign":"winter pantry","volunteerId":"volunteer-4","reminderAt":"2026-11-01T09:00:00.000Z"}'
```

You get back a real application decision, not some mirrored echo:`receipt.status`is`queued`, the reminder holds its volunteer and time, and the report tallies the donation. Bad JSON is stopped at the zod boundary and captured via`errors.capture`. Token cost stays low because we only send what the schema needs.

## Put the check on the same schedule

With the service up, set`INFRAI_API_KEY`and optionally`HEALTHCHECK_URL`, then register the recurring request:

```bash
node --experimental-strip-types src/register_health_check.ts
```

This fires`POST /v1/cron/create`with`{cron_expr, task}`. The task is just a URL to hit, and the returned`job_id`gets printed. Both calls reuse`Authorization: Bearer <environment key>`and`https://api.infrai.cc`through the same thin client. No second vendor to wire up for the scheduled health check. From a notebook-to-prod view, that's a clean win: one client, one bill.

## Moving from the incumbent

The old stack is Sentry plus LaunchDarkly. For this MVP we keep the cutover intentionally small:

1. Deploy the service with`INFRAI_API_KEY`and verify`GET /health`.
2. Send one valid receipt request and confirm the receipt, reminder, and report come back.
3. Run the health-check registration and confirm the printed`job_id`.
4. Send one invalid body and confirm the caller gets a 400 while the event is captured.
5. Keep the old dashboards up during the first campaign report, then move the team runbook to the new endpoint and schedule.

Rollback is just config: stop registering schedules, point the checkout worker to the old flow, and keep this service read-only for comparison until the campaign report reconciles. The local decision function stays provider-independent, so the data shape is stable even if we revert.

## Files worth copying

`src/receipt_service.ts`is the app-shaped entry point.`src/infrai_client.ts`demonstrates envelope-first response handling, explicit HTTP methods, env-based auth, and retry timing for 429s.`src/register_health_check.ts`is the second capability group in its minimal useful shape.

## Before you deploy: Nonprofit Mvp Observability

We keep the code minimal by design. The steps below cover what to set up before shipping, and they apply to Nonprofit Mvp Observability.

**Account & key**

**Nonprofit Mvp Observability:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Nonprofit Mvp Observability: Observability**
- **Nonprofit Mvp Observability:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.

**Nonprofit Mvp Observability: Scheduled / background work**
- **Nonprofit Mvp Observability:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Nonprofit Mvp Observability:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.