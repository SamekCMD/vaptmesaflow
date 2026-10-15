# Phase 8 — billing email Queue and Resend design

Date: 2026-09-28

## Intent and scope

Deliver transactional Stripe billing email asynchronously for preview and production without making the webhook depend on Resend. The product has no real customers yet, so preview validation uses synthetic billing events and Resend's test recipient. Keep the current Coolify API until the separately planned API-to-Workers migration. Do not change DNS, Vercel, Easypanel, auth email templates, or unrelated billing behavior.

The user approved a small Cloudflare Worker per environment for outbox dispatch and Queue consumption, and approved creating four billing templates in the authenticated Resend workspace using the existing auth templates' visual and writing style. This resolves the master plan's assumption that those four templates were already published: on 2026-09-28 the workspace displayed only `account-confirmation` and `password-reset`.

## Existing contracts

- Stripe webhook processing already writes a deduplicated intent to `public.billing_email_outbox` in the same transaction as billing state. It does not call Resend.
- `invoice.paid` owns `subscription_activated` when `billing_reason=subscription_create` and `subscription_renewed` when `billing_reason=subscription_cycle`. `invoice.payment_failed` owns `payment_failed` for a non-current payment status. `customer.subscription.deleted` owns `subscription_cancelled`. Checkout and subscription-updated events never create a second message for the same purchase.
- The current outbox has unique keys on `(provider_event_id,email_kind)` and `(restaurant_id,billing_resource_id,email_kind)`; its `payload` contains plan type/status and current period end. `pending`, `processing`, `sent`, `pending_retry`, and `dead_letter` are existing states.
- Cloudflare already has `vapt-emails-preview` and `vapt-emails-production`, both inactive and without a consumer. Do not replace or rename them.
- The source of the billing recipient is the owning `better_auth.user.email` joined through `public.restaurants.owner_id`. Only server-side code can access the outbox and recipient. Queue messages contain only the outbox UUID and a non-sensitive correlation identifier, never an email address, Stripe payload, or template variables.

## Approaches considered

1. Publish to Queue in the webhook after the database commit: closest to the original diagram, but a failed publish after commit can strand the email because a repeated Stripe event is already marked processed.
2. Dispatch from the Coolify API through Cloudflare's HTTP publish API: workable, but requires a temporary broad Queue credential in the legacy runtime and replacement during the API migration.
3. **Selected:** a scheduled Worker polls the durable outbox and publishes IDs to its environment's existing Queue; the same Worker consumes the Queue and calls Resend. It keeps email delivery independent of the current API host and can remain when the API moves to Workers.

## Components and flow

Each environment has its own Worker, Neon branch connection, Queue binding, and Queue consumer subscription. A one-minute Cron trigger selects a bounded batch of due `pending`/`pending_retry` rows with an atomic database claim, advances `next_attempt_at` to prevent an immediate duplicate publish, then publishes `{outboxId, correlationId}`. A failed publish leaves the row eligible for a later dispatch with bounded backoff. A successful publish does not mark it sent; Neon remains the durable source of truth if Queue retention expires.

The Queue consumer validates the message, atomically leases a row, and exits successfully for an already `sent`/`dead_letter` row or another active lease. Before the first network send it looks up the owner and restaurant and commits an immutable snapshot of recipient, template alias and rendered variables; every retry reuses that exact request. The Worker calls the published Resend template by alias with a stable idempotency key derived from the outbox UUID. On success it marks the row `sent` and records the Resend message ID. A failed call classifies permanent errors into `dead_letter`; transient errors become `pending_retry` with exponential backoff and a cap. The Cron also reclaims expired `processing` leases: it safely republishes the row within the Resend idempotency window, or parks an uncertain older send in `dead_letter`. Queue retries cover failures before the database can record an outcome; environment-specific dead-letter Queues retain exhausted messages for investigation, while the Neon outbox remains the longer-lived audit record.

The existing schema needs an additive migration for `first_send_attempt_at`, `recipient_email`, `template_alias`, `template_variables`, and `resend_email_id` to make the request stable across retries and record its result. The payload snapshot and recipient are private database fields, never logged or placed in Queue messages. Workers use a server-side Neon connection suitable for Cloudflare and separate secret bindings for the database and Resend. Credentials and recipients are never committed.

Resend retains idempotency keys for only 24 hours. Therefore an uncertain send result is retried automatically only inside that window with the exact same request; after the window, it goes to `dead_letter` for manual reconciliation rather than risking a duplicate email. A definite pre-send failure can continue normal retry/backoff. This is at-least-once processing with duplicate-send safeguards, not an unsupported exactly-once claim.

## Resend templates

Create and publish four templates in the current workspace. Use the sender `no-reply <no-reply@vapt.app.br>`, the existing auth templates' approximately 600 px layout, `#F8F8F7` page background, white bordered rounded card, pale-green hero (`#E9F1EE`), dark-green headings (`#2D5342`), green links (`#3D6C57`), concise Brazilian Portuguese copy, and the same Vapt footer. Include a plain-text version and a responsive HTML version in Resend; do not store either in the repository. Do not modify `account-confirmation` or `password-reset`.

| Outbox kind | Alias | Subject / central message | Action |
| --- | --- | --- | --- |
| `subscription_activated` | `billing-subscription-activated` | `Sua assinatura Vapt está ativa` / confirm that the `PLAN_NAME` plan for `RESTAURANT_NAME` is active, without claiming a charge if this was a trial | `Ver assinatura` |
| `subscription_renewed` | `billing-subscription-renewed` | `Sua assinatura Vapt foi renovada` / confirm the cycle payment for `PLAN_NAME` | `Ver assinatura` |
| `payment_failed` | `billing-payment-failed` | `Não foi possível confirmar seu pagamento no Vapt` / ask the owner to review payment details, without claiming immediate loss of access | `Revisar pagamento` |
| `subscription_cancelled` | `billing-subscription-cancelled` | `Sua assinatura Vapt foi cancelada` / confirm cancellation without promising an unverified access end date | `Ver assinatura` |

Every template uses exactly `RESTAURANT_NAME`, `PLAN_NAME`, and `BILLING_URL` as required variables. `PLAN_NAME` is derived from the existing `starter`/`pro`/`business` product labels. `BILLING_URL` is the fixed, validated `https://vapt.app.br/dashboard/subscription` route; no Stripe customer portal URL or unvalidated dynamic link is embedded. Before integration, inspect the published template contract and perform a real test-address send to verify the variable names and case (the existing auth template's visual placeholder case differed from its published send contract).

## Observability and failures

Structured logs include environment, outbox UUID, Stripe event ID, email kind, attempt, and outcome, but no recipient, token, URL, request body, or provider secret. Monitor due-row age, retry count, `dead_letter` count, Queue backlog/lag and Cloudflare DLQ depth. Provide a safe read-only operational query/runbook for inspection and explicit manual replay after reconciliation; do not automatically replay dead letters or delete them. A missing owner, missing template/configuration, invalid payload, or Resend validation failure must not silently mark a row sent.

## Validation and rollout

1. Unit-test event ownership, publisher claim/recovery, consumer duplicate/in-flight behavior, immutable request snapshots, retry/backoff, permanent error handling, and 24-hour ambiguous-result cutoff. Include a crash-after-Resend-success test with the same idempotency key.
2. Apply the additive migration and its verifier to the preview Neon branch, then production after preview passes. Run existing schema/integrity verifiers and keep the two branches structurally aligned.
3. Publish the four Resend templates and verify their exact contract with `delivered@resend.dev`; inspect the rendered email for desktop/mobile and plain text. No actual customer addresses are used in validation.
4. Deploy only the preview Worker and Queue consumer first. Test a synthetic initial payment, renewal, failure, cancellation, duplicate Queue delivery, transient Resend failure, and dead-letter path. Confirm one successful email per outbox row and no synchronous Resend call in the webhook.
5. Configure production Worker/Queue parity only after preview passes. No live Stripe charge or real-customer email is needed for this development-stage migration. Keep secrets in Cloudflare, not Git, and document the operational state and any unactivated production resources.

## Source constraints

- Cloudflare Queues are at-least-once: https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- Scheduled Worker handler: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- Queue retry and DLQ: https://developers.cloudflare.com/queues/configuration/batching-retries/ and https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
- Resend idempotency key retention and response behavior: https://resend.com/changelog/idempotency-keys
