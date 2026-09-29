# Phase 8 — billing email Queue runbook

## Scope and immutable choices

The billing webhook only writes the Neon outbox intent. A scheduled Cloudflare Worker publishes outbox IDs to the existing environment Queue; its consumer sends the frozen request through a published Resend template. Runtime secrets, recipients and message variables never belong in this file or Git. Vercel and Easypanel are legacy; this phase does not change DNS or the Coolify API.

## Migration 006

- File: `infra/neon/006_billing_email_delivery.sql`
- SHA-256: `14D60EA7BDF53AEE40113FF3007DBC79380D2DA0250B524F375CFED0765D2318`
- Preview: project `dawn-morning-27332079`, branch `br-rough-dew-b6ydeygb`, database `vapt`, direct connection.
- Before migration, `verify-billing-email-delivery.sql` failed as expected because all five delivery columns were absent. Existing outbox rows: 0.
- Applied the exact SQL file on 2026-09-28. After migration, `verify-billing-email-delivery.sql`, `verify-baseline.sql`, `verify-integrity.sql`, and `verify-stripe-billing.sql` all completed successfully. Existing outbox rows remained 0.
- Production branch `br-odd-term-b6j2n9ms` remains unchanged until the preview delivery flow is verified.

## Resend templates

The four billing templates were published on 2026-09-28 from the existing auth template visual pattern (Vapt wordmark, pale hero, rounded white card, green action, narrow-screen-friendly 600px maximum width, and the same footer). The two published auth templates remain unchanged. All four use `no-reply <no-reply@vapt.app.br>`, define exactly `RESTAURANT_NAME`, `PLAN_NAME`, and `BILLING_URL`, and include an automatically generated plain-text alternative. Fallback-value warnings are expected because the Worker must supply all three variables.

| Kind | Published alias | Template ID | Subject |
| --- | --- | --- | --- |
| `subscription_activated` | `billing-subscription-activated` | `35974466-e47a-4f55-916d-2775a1e168bf` | Seu plano Vapt foi ativado |
| `subscription_renewed` | `billing-subscription-renewed` | `688d3ff1-5d46-4c10-8b2b-a883c83625a2` | Seu plano Vapt foi renovado |
| `payment_failed` | `billing-payment-failed` | `6916f5e5-86db-430e-bb98-385dddcb67c1` | Não conseguimos confirmar seu pagamento no Vapt |
| `subscription_cancelled` | `billing-subscription-cancelled` | `2d06f6d6-4fef-47f4-a837-399d0be40e7a` | Sua assinatura Vapt foi cancelada |

After action-time confirmation, one Resend test send per template went to `delivered@resend.dev` with `RESTAURANT_NAME=Restaurante Teste Vapt`, `PLAN_NAME=Pro`, and `BILLING_URL=https://vapt.app.br/dashboard/subscription`. Resend displayed `Delivered` for all four and each detail preview rendered the restaurant name, plan label, and subscription link correctly. Test message IDs, in table order: `01a0e884-f52b-72cb-8ff9-0c30bad042dd`, `01a0e886-4072-76cb-ab9a-2e3a9cae1b7d`, `01a0e887-6b28-724b-aea9-9317aff78a7b`, `01a0e888-740a-73c2-95d2-ec9e59aa6798`. No customer addresses were used.

Desktop previews were visually checked. A narrow-screen preview control was not available in the Resend editor/browser interface used here; the template body uses fluid `width:100%`, a `600px` maximum width, and `24px` content padding, but mobile rendering remains a visual QA follow-up before a live-customer send.

## Preview deployment and validation

On 2026-09-28, Cloudflare account `3ce69408aa5112617a282957aba71932` had the existing `vapt-emails-preview` and `vapt-emails-production` Queues. The separate `vapt-emails-preview-dlq` was created. `vapt-billing-email-preview` was first bootstrapped without a route, Cron or Queue consumer, because installing Wrangler secrets deploys a Worker version. Its branch-scoped pooled Neon `DATABASE_URL` and a Resend Sending-only, `vapt.app.br`-restricted `RESEND_API_KEY` were then installed as encrypted Worker secrets. No values were written to this repository. Two interim Resend keys exposed to the private browser accessibility trace were revoked after rotation; only the final restricted billing key remains active.

The preview smoke used Worker version `21e20815-7f29-4e89-a9a2-c191c296e227`, with `* * * * *` Cron, one producer and one consumer on `vapt-emails-preview`, batch size 10, 60-second retry delay, three Queue retries and `vapt-emails-preview-dlq`. No route or workers.dev URL was enabled. The production Queue still had zero producers and consumers at this preview gate. Afterward, preview was redeployed as version `1c9400e9-4e7d-4dfa-a576-78e2b64f2dbc` with `preview_urls: false`; its Cron/Queue bindings and secrets were retained.

The preview Neon branch started with zero restaurants, Better Auth users and outbox rows. A disposable owner/restaurant with a unique `BillingSmoke20260928` marker and `delivered@resend.dev` address supplied four synthetic outbox intents. Cron dispatched each to the Queue; the Worker recorded each as `sent`, attempt 1, no error, with the expected published alias. Resend showed `Delivered` for exactly these four message IDs:

| Kind | Outbox ID | Resend ID |
| --- | --- | --- |
| `subscription_activated` | `e9261d19-bc7f-46e5-a135-6cd1191ce216` | `01a0e9fe-cab8-7211-8213-c7493d6f0ff4` |
| `subscription_renewed` | `bb52ff90-a5ac-4db7-bb58-3a844fb5c925` | `01a0e9fe-cf4b-7620-9cb2-f630d2ee3592` |
| `payment_failed` | `e5ac4de5-148b-45b7-911b-4db184175c1c` | `01a0e9fe-d3a5-7151-9e6d-8bc374420064` |
| `subscription_cancelled` | `76a1754d-f774-4e9e-84a8-a618a4494d45` | `01a0e9fe-d68e-7294-a879-dc3f0af854e8` |

Re-inserting the activated intent with the same business and event keys returned zero new rows. Replaying its Queue body left all four rows at attempt 1 with the same Resend IDs; the already-sent message was acknowledged without another send. The API's Stripe webhook service/repository tests cover transactional outbox insertion and duplicate event handling, and the API source has no billing Resend call. This live smoke inserted synthetic intents directly rather than posting signed Stripe events to the Coolify API; it validates the deployed outbox-to-email path, not the remote webhook ingress. The Worker tests cover transient Resend errors, exponential backoff, stale-lease recovery and the 24-hour uncertainty cutoff without emitting extra live emails.

A malformed, recipient-free JSON message was submitted to `vapt-emails-preview`. The consumer rejected it, Cloudflare exhausted the configured retries and `vapt-emails-preview-dlq` showed one message of realtime backlog at 20:42 BRT. The source Queue later showed zero realtime backlog, six ingested messages and six acknowledged messages. This synthetic dead letter is intentionally retained for manual inspection; it must not be replayed or purged automatically. No outbox row or email resulted from that malformed body. The scoped cleanup removed the one marked synthetic restaurant and its owner; the four outbox rows cascaded. A final preview query returned zero outbox rows (including zero active), restaurants and Better Auth users.

The deployed preview exercised Queue retry/DLQ behavior; Resend transient-failure, exponential-backoff, lease-recovery and ambiguous-send cases were exercised with fake senders plus real preview Postgres integration tests, not by deliberately failing live Resend delivery. The final Worker run passed 47/47 tests with preview Postgres and the API suite passed 397/397. The remote Stripe webhook ingress remains a separate activation check before a real customer billing event.

## Deployment and operations

### Production parity

On 2026-09-28, production branch `br-odd-term-b6j2n9ms` of Neon project `dawn-morning-27332079` had zero outbox rows and zero active deliveries, and none of migration 006's five columns. The exact reviewed migration file, SHA-256 `14D60EA7BDF53AEE40113FF3007DBC79380D2DA0250B524F375CFED0765D2318` after checkout line-ending normalization, was applied via a direct (non-pooled) connection. The billing-email, baseline, integrity and Stripe-billing verifiers passed. A fresh read showed five delivery columns and zero outbox/active rows on both production and preview; no synthetic preview records were copied.

`vapt-emails-production-dlq` was created separately from the existing production Queue. `vapt-billing-email-production` was bootstrapped without triggers or routes, then given the production-branch pooled Neon URL and a separate Resend Sending-only key restricted to `vapt.app.br`, each as an encrypted Worker secret. The final deployment is version `ef3909ca-1af8-4160-b1df-1c66b9e4412b`: one-minute Cron, one producer and one consumer on `vapt-emails-production`, its own DLQ, and no workers.dev/custom route or preview URL. Cloudflare showed `DATABASE_URL` and `RESEND_API_KEY` as encrypted secrets and the production Queue binding. A post-deploy Queue listing showed one producer/consumer on each environment's primary Queue and none on either DLQ; the production Queue had zero ingested messages and zero realtime backlog at 21:00 BRT. No production test email or Stripe Live event was created.

### Read-only monitoring

Run against the intended Neon branch with read-only credentials, and keep email addresses, template variables and connection strings out of incident tickets and logs:

```sql
select delivery_status, email_kind, count(*) as rows,
       min(created_at) as oldest_created_at, max(attempt_count) as max_attempts
from public.billing_email_outbox
group by delivery_status, email_kind
order by delivery_status, email_kind;

select id, email_kind, delivery_status, attempt_count, created_at,
       next_attempt_at, processing_started_at, first_send_attempt_at,
       sent_at, last_error, resend_email_id
from public.billing_email_outbox
where delivery_status in ('pending', 'pending_retry', 'processing', 'dead_letter')
order by next_attempt_at, created_at
limit 100;
```

Investigate a due `pending`/`pending_retry` row older than five minutes, a `processing` lease older than 15 minutes, any `dead_letter`, or growing Queue backlog/consumer lag. Compare the Worker Cron invocations and Queue `Messages Ingested`, `Acknowledged`, `Retried`, realtime backlog and DLQ backlog in the matching environment. Both DLQs currently have message retention `86400` seconds (one day); inspect a nonzero DLQ within that window. The preview DLQ contains one intentionally malformed synthetic message from validation. The outbox, not the Queue, is the longer-lived delivery record.

### Manual reconciliation and rollback

Do not bulk-purge a Queue, auto-replay a DLQ, or delete outbox rows. For a specific outbox UUID, first inspect its state and the corresponding Resend message ID/idempotency key `billing/<outboxId>` in the correct environment. A `sent` row needs no replay. For `dead_letter` or an uncertain send, establish whether Resend accepted it before any retry; after the 24-hour idempotency window, a blind resend risks a duplicate. Investigate malformed DLQ bodies separately; the preview test message has no valid outbox UUID and must not be replayed. If a Queue message is lost while the row remains due, the one-minute Cron republishes its ID after the dispatch reservation expires; avoid manually inserting another intent.

If delivery must stop, remove the affected Worker's Cron trigger and Queue consumer in Cloudflare `Settings → Trigger events` (or deploy an explicitly reviewed no-trigger config), then verify the Queue has no active consumer. Keep the outbox, Queue and secrets intact for diagnosis. The API may continue creating intents while delivery is paused. Recheck due rows, Resend outcomes and the 24-hour uncertainty boundary before restoring exactly one Cron and one consumer; do not reset `attempt_count` or frozen recipient/template data casually. This is a Worker-delivery rollback, not a schema rollback: migration 006 is additive and should remain.

### Live activation gates

No DNS, Vercel, Easypanel, Coolify API, Stripe Live or auth-template change is part of this Worker deployment. Before customer billing, complete a signed webhook ingress smoke against the final API URL, confirm Stripe Live products/Prices, Portal configuration, secrets and event-selected webhook endpoint, inspect the four billing templates in a narrow email client, decide whether one-day DLQ retention and alerting are sufficient, and monitor the first controlled lifecycle. The current four real email deliveries used only Resend's test recipient; production wiring is ready but has not sent to a real customer.
