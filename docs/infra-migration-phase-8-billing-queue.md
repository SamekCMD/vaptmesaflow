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

## Deployment and operations

Pending Tasks 7–8. No Worker is deployed by the schema migration alone.
