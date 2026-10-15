# Phase 8 Billing Email Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the four Stripe billing notifications through durable Neon outbox intents, the existing Cloudflare Queues, and published Resend templates in preview and production.

**Architecture:** One scheduled/Queue-consumer Worker per environment polls the outbox and publishes IDs, then claims each row and sends its frozen request through Resend. Neon remains authoritative; a stable Resend idempotency key and a 24-hour uncertainty cutoff prevent unsafe automatic duplicates.

**Tech Stack:** TypeScript, Cloudflare Workers/Queues/Cron/Wrangler 4.138.0, Neon Postgres with `@neondatabase/serverless` HTTP, Resend SDK 6.28.1, Node 24/`tsx` tests.

**Spec:** `docs/infra-migration-phase-8-billing-queue-design.md`

## Global Constraints

- Reuse `vapt-emails-preview` and `vapt-emails-production`; do not change DNS, Vercel, Easypanel, the Coolify API, or auth email templates.
- Queue bodies contain only `{version:1,outboxId,correlationId}`; never place recipient, Stripe payload, or template variables in Queue/logs/Git.
- Use `no-reply <no-reply@vapt.app.br>` and four published Resend templates with exactly `RESTAURANT_NAME`, `PLAN_NAME`, `BILLING_URL`; no HTML or subject duplication in application code.
- Use the fixed link `https://vapt.app.br/dashboard/subscription`, and plan labels `Starter`, `Pro`, `Business`.
- Preview tests send only to `delivered@resend.dev`; do not send to real customer addresses or use Stripe Live.
- One-minute Cron, at most 20 due rows per invocation, five-minute dispatch reservation, 15-minute delivery lease, at most eight send attempts, retry delays from 60 to 3600 seconds, and a 24-hour cutoff for uncertain Resend outcomes.
- Each Queue consumer uses batch size 10, retry delay 60 seconds, max retries 3, and its own `-dlq`; do not replay or delete dead letters automatically.
- Use a direct Neon connection only for applying SQL migrations. Runtime Workers use separate branch-scoped pooled URLs stored as secrets; no new Neon project/branch.

## Review Focus

1. Malformed Queue message or a batch from the wrong Queue name: reject it without reading another branch or leaking a recipient (Task 3 test).
2. Owner email or restaurant name changes during retry: resend the exact frozen request, not changed values (Task 4 test).
3. Worker dies after Resend accepts but before `sent` persists: recover with the same key inside 24 hours; park after 24 hours (Tasks 4 and 6 tests).
4. Resend `409` invalid request vs concurrent request: dead-letter the former, retry the latter (Task 6 test).
5. Queue outage or retention expiry: due outbox row is republished, not lost or falsely marked sent (Task 5 test).

---

## File map

- `infra/neon/006_billing_email_delivery.sql`: additive snapshot and delivery metadata.
- `infra/neon/verify-billing-email-delivery.sql`: SQL assertions for new columns, checks, indexes, and privileges.
- `infra/cloudflare/billing-email-worker/package.json`, `package-lock.json`, `tsconfig.json`: isolated Worker package and tests.
- `infra/cloudflare/billing-email-worker/wrangler.preview.jsonc`, `wrangler.production.jsonc`: names, Cron, Queue producer/consumer and DLQ bindings; no secrets.
- `infra/cloudflare/billing-email-worker/src/contracts.ts`: Queue payload, kinds, frozen request and typed repository/send interfaces.
- `infra/cloudflare/billing-email-worker/src/templates.ts`: event-to-alias and safe variable mapping, not template HTML/copy.
- `infra/cloudflare/billing-email-worker/src/outbox-repository.ts`: atomic Neon SQL claims, snapshot, state transitions and lease recovery.
- `infra/cloudflare/billing-email-worker/src/dispatcher.ts`: bounded Cron selection and Queue publishing.
- `infra/cloudflare/billing-email-worker/src/resend-gateway.ts`: published-template send with idempotency key and sanitized error classification.
- `infra/cloudflare/billing-email-worker/src/consumer.ts`: per-message delivery orchestration.
- `infra/cloudflare/billing-email-worker/src/index.ts`: Cloudflare `scheduled` and `queue` handlers, environment validation and structured log boundary.
- Matching `src/*.test.ts`: focused Node test suite with fake clocks, Queue, repository and Resend gateway; no live credentials.
- `docs/infra-migration-phase-8-billing-queue.md`: published-template inventory, deployment evidence, monitoring and manual reconciliation runbook.

### Task 1: Additive delivery schema

**Files:** Create `infra/neon/006_billing_email_delivery.sql`, `infra/neon/verify-billing-email-delivery.sql`; update `infra/neon/verify-integrity.sql` only if the new index/constraints need the global verifier.

**Interfaces:** Existing `public.billing_email_outbox`; produces nullable `first_send_attempt_at timestamptz`, `recipient_email text`, `template_alias text`, `template_variables jsonb`, `resend_email_id text`, plus a partial index on `processing_started_at` for `processing` leases.

- [ ] **Step 1:** Write the SQL verifier asserting those five column types/nullability, `template_variables` object-or-null check, processing index, and no `PUBLIC` privilege; run it against preview before migration and record the expected failure.
- [ ] **Step 2:** Write migration 006 inside `BEGIN`/`COMMIT`, preserving all existing rows, unique constraints and status values; use `ALTER TABLE ... ADD COLUMN` and the stated check/index only.
- [ ] **Step 3:** Apply exactly that file to Neon preview branch `br-rough-dew-b6ydeygb` using its direct connection; run the new verifier plus `verify-baseline.sql`, `verify-integrity.sql`, and `verify-stripe-billing.sql`. Expected: all pass and existing outbox rows remain unchanged.
- [ ] **Step 4:** Record migration SHA-256 and preview verifier result in the Phase 8 runbook; commit only the reviewed SQL and runbook.

### Task 2: Publish four Resend templates

**Files:** Modify only `docs/infra-migration-phase-8-billing-queue.md` locally; create/publish the four templates in the authenticated Resend workspace. No template HTML in Git.

**Interfaces:** Produces published aliases `billing-subscription-activated`, `billing-subscription-renewed`, `billing-payment-failed`, `billing-subscription-cancelled`, each with exactly the three required variables in the spec.

- [ ] **Step 1:** Capture the published auth templates' visual/wording pattern and draft each billing subject, preview text, HTML and plain text in Resend; inspect desktop and narrow-screen previews before publishing.
- [ ] **Step 2:** Publish the four templates using the approved sender, then retrieve each published alias and assert its exact sender, subject, status and case-sensitive variable keys. Keep the two auth templates unchanged.
- [ ] **Step 3:** Send one example of each to `delivered@resend.dev` with safe synthetic values and `BILLING_URL`; verify Resend reports delivery and the rendered variable/link values. Do not send to user or customer addresses.
- [ ] **Step 4:** Add aliases, non-secret template IDs, variable contract and test evidence to the runbook; commit that inventory.

### Task 3: Worker package and message/template contracts

**Files:** Create the Worker package/config files and `src/contracts.ts`, `src/templates.ts`, `src/contracts.test.ts`, `src/templates.test.ts` from the file map.

**Interfaces:** `parseMessage(value: unknown): OutboxMessage`; `assertQueueSource(queueName: string, expectedEnvironment: 'preview'|'production'): void`; `snapshotFor(kind: BillingEmailKind, restaurantName: string, planType: 'starter'|'pro'|'business', recipientEmail: string): EmailSnapshot`; `EmailSnapshot={to,templateAlias,variables}` with exactly the three variable keys.

- [ ] **Step 1:** Create the isolated package/test scripts pinned to Wrangler `4.138.0`, Resend `6.28.1`, Neon serverless `^1.0.0` (commit the resolved lockfile), TypeScript `5.8.3` and `tsx` `4.23.15`; write tests for the four kind-to-alias mappings, plan labels, fixed URL, missing/extra variables, UUID format, version mismatch and wrong Queue name. Run `npm test` and see RED.
- [ ] **Step 2:** Implement only the tested mapping and validation in `contracts.ts`/`templates.ts`.
- [ ] **Step 3:** Write preview/production Wrangler JSONC with Worker names `vapt-billing-email-preview`/`vapt-billing-email-production`, Cron `* * * * *`, the matching existing Queue, producer binding `BILLING_EMAIL_QUEUE`, consumer settings from Global Constraints, and `vapt-emails-preview-dlq`/`vapt-emails-production-dlq`.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, and `npx wrangler deploy --dry-run --config wrangler.preview.jsonc` (then production config). Expected: all pass, no secret values emitted; commit package, lockfile, config and tests.

### Task 4: Atomic outbox repository

**Files:** Create `src/outbox-repository.ts`, `src/outbox-repository.test.ts` and `src/outbox-repository.integration.test.ts` in the Worker package.

**Interfaces:** `createOutboxRepository(databaseUrl: string): OutboxRepository`; methods `reserveDispatch(now, limit)`, `deferDispatch(outboxId, nextAt)`, `claimDelivery(outboxId, now)`, `saveSnapshot(lease, snapshot, now)`, `markSent(lease, resendId, now)`, `scheduleRetry(lease, code, nextAt)`, `markDeadLetter(lease, code)`, `reapExpired(now)`. `lease` contains outbox UUID and incremented `attemptCount` for fencing.

- [ ] **Step 1:** Write failing tests asserting atomic due-row reservation, five-minute next-at advance, recipient join, one-time snapshot, 15-minute lease/fencing, already-sent skip, permanent failure, and expired lease inside/outside 24 hours.
- [ ] **Step 2:** Implement each transition as a parameterized static SQL statement through `@neondatabase/serverless` HTTP; use `UPDATE ... RETURNING` and `FOR UPDATE SKIP LOCKED` CTEs where needed, never hold a database lock across a Queue/Resend network call.
- [ ] **Step 3:** Run package tests/typecheck; add a preview-only `outbox-repository.integration.test.ts` real-Postgres concurrency smoke, gated by the preview pooled URL, with disposable rows, scoped cleanup and no outbound email. Expected: only one delivery lease wins, stale attempt cannot write `sent`, and the saved snapshot stays byte-equivalent on retry.
- [ ] **Step 4:** Commit repository and tests; keep connection strings and synthetic recipient out of Git/logs.

### Task 5: Durable Cron dispatcher

**Files:** Create `src/dispatcher.ts`, `src/dispatcher.test.ts`; wire `scheduled` in `src/index.ts` with its test.

**Interfaces:** `dispatchDue(repository: OutboxRepository, queue: Queue<OutboxMessage>, now: Date): Promise<DispatchSummary>` publishes `{version:1,outboxId,correlationId}` only; no Resend dependency.

- [ ] **Step 1:** Write failing tests for a 20-row cap, no PII in messages, publish failure/backoff, duplicate Cron overlap, stale `processing` recovery and lost Queue-message republish after reservation expiry.
- [ ] **Step 2:** Implement the bounded publisher and one-minute handler; recover stale leases before claiming due rows. A Queue publish result never marks a row `sent`.
- [ ] **Step 3:** Run package tests/typecheck and Wrangler dry-run for both configs; commit dispatcher and tests.

### Task 6: Idempotent Resend consumer

**Files:** Create `src/resend-gateway.ts`, `src/resend-gateway.test.ts`, `src/consumer.ts`, `src/consumer.test.ts`; wire `queue` in `src/index.ts` with its test.

**Interfaces:** `sendBillingEmail(snapshot: EmailSnapshot, outboxId: string): Promise<{kind:'sent',resendId:string}|{kind:'retry'|'permanent'|'unknown',code:string}>`; stable idempotency key `billing/<outboxId>`; `consumeBillingMessage(message, repository, gateway, now): Promise<'ack'|'retry'>`.

- [ ] **Step 1:** Write failing tests for all four aliases, exact `template:{id,variables}` send shape, same key/request after a crash, sent/in-flight skips, 409 concurrent retry vs invalid-payload dead letter, 429/5xx backoff, timeout uncertainty and the 24-hour cutoff.
- [ ] **Step 2:** Implement the SDK adapter and consumer using the frozen snapshot, lease token and eight-attempt cap. Log only IDs, kind, attempt and a safe error code; if state persistence fails, ask Queue to retry rather than acknowledging.
- [ ] **Step 3:** Run all package tests/typecheck, both Wrangler dry-runs, and existing API `npm test`/`npm run build` to prove webhook behavior remains unchanged; commit consumer and tests.

### Task 7: Preview deployment and end-to-end evidence

**Files:** Update `docs/infra-migration-phase-8-billing-queue.md`; no API/DNS change.

**Interfaces:** Preview Worker binds preview Neon URL and a sending-only Resend secret; consumes only `vapt-emails-preview`; preview DLQ is separate.

- [ ] **Step 1:** Recheck preview schema/template contract, Cloudflare account and Queue names; create only the preview DLQ and install preview Worker secrets via protected input (no values in commands/logs/Git).
- [ ] **Step 2:** Deploy `wrangler.preview.jsonc`; verify Cron and the Queue's single consumer are active, while production remains unchanged.
- [ ] **Step 3:** Run synthetic initial paid, renewal, failed payment and cancellation events to create four disposable outbox rows; verify one delivered test-address email per kind, no duplicate on event/message replay, no synchronous webhook Resend call, and recovery/backoff behavior. Exercise a controlled DLQ case without real recipients.
- [ ] **Step 4:** Clean up only identifiable synthetic preview records; verify outbox/Queue health, capture sanitized evidence and commit the preview runbook update.

### Task 8: Production parity and handoff

**Files:** Update `docs/infra-migration-phase-8-billing-queue.md` with production evidence and operations.

**Interfaces:** Production Worker uses only production Neon/Queue secrets and the same four published Resend aliases; no Stripe Live wiring in this phase.

- [ ] **Step 1:** Apply the identical migration 006 bytes to production branch `br-odd-term-b6j2n9ms` over a direct connection; run the new and existing verifiers, compare hashes/schema with preview, and confirm no synthetic rows were copied.
- [ ] **Step 2:** Confirm production outbox has no due rows before activation; if it does, stop and reconcile them. Then create production DLQ, add branch-specific secrets through protected input, deploy `wrangler.production.jsonc`, and verify production Cron/consumer bindings independently. Do not send a real-customer email or create a Stripe Live event.
- [ ] **Step 3:** Document read-only SQL for pending/retry/dead-letter inspection, Queue metrics and DLQ retention, manual reconciliation/replay steps, rollback by disabling Worker Cron/consumer without dropping outbox data, and exact unresolved Live activation gates.
- [ ] **Step 4:** Run final Worker tests/typecheck/dry-runs, Neon verifiers, API tests/build, `git diff --check` and status; commit documentation and hand off the results without push/PR unless requested.
