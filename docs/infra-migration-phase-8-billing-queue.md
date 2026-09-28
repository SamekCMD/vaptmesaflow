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

Pending Task 2. The four billing template aliases are `billing-subscription-activated`, `billing-subscription-renewed`, `billing-payment-failed`, and `billing-subscription-cancelled`; each requires `RESTAURANT_NAME`, `PLAN_NAME`, and `BILLING_URL`. Auth templates remain unchanged.

## Deployment and operations

Pending Tasks 7–8. No Worker is deployed by the schema migration alone.
