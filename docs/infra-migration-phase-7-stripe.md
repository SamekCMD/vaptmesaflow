# Phase 7 — Stripe billing consolidation

Date: 2026-09-27

This report fixes the pre-migration boundary for Stripe billing. It contains no credentials or webhook signing secrets.

## RED baseline

The current API does not own the Stripe lifecycle:

- `src/modules/billing/stripe/routes.ts` instantiates `createN8nClient` for checkout, subscription change and cancellation.
- `src/modules/webhooks/routes.ts` instantiates `createN8nClient`; `src/modules/webhooks/service.ts` forwards the raw Stripe webhook through `forwardWebhook`.
- `src/modules/n8n/contracts.ts` still declares the `stripe.subscriptionChange` and `stripe.subscriptionCancel` workflows.
- `STRIPE_SECRET_KEY` is absent from the API configuration, `.env.example` and README.
- there is no Customer Portal route in the API.
- `src/components/dashboard/StripeCheckoutModal.tsx` embeds Stripe Elements/`PaymentElement` and waits for a `clientSecret` returned by the forwarding workflow.
- `src/lib/n8n-client.ts` exposes create/change/cancel operations to the browser, with responses shaped around `clientSecret` and `subscriptionId`.

The reproducible discovery command is:

```powershell
rg -n "createN8nClient|forwardWebhook|subscriptionChange|subscriptionCancel|STRIPE_SECRET_KEY|portal" src .env.example README.md
```

## Stripe Test Mode inventory

Read-only inventory completed through the authenticated Dashboard and official SDK.
The Dashboard's Vapt Test Mode catalog (`acct_1UKK1yH4hY0s7wXr`) contains no products.
The Test Mode key displayed by onboarding belongs to the isolated sandbox
`acct_1UKK2EQYNWCekS7F`; SDK reads below are scoped to that sandbox, which is the
target for the preview smoke. All resource lists are empty, so no live resources
are being reused. Credential values are held only in a Git-ignored local file.
No resource was created or modified during inventory.

| Resource | Non-secret identifier | Expected configuration | Observed mode/state |
| --- | --- | --- | --- |
| Starter product/Price | absent | monthly recurring, `brl`, 9,700 cents, active | Test Mode; create in Task 9 |
| Pro product/Price | absent | monthly recurring, `brl`, 19,700 cents, active | Test Mode; create in Task 9 |
| Business product/Price | absent | monthly recurring, `brl`, 34,700 cents, active | Test Mode; create in Task 9 |
| Customer Portal configuration | absent (`configurations.list` is empty) | updates, cancellation, payment methods and invoices | Test Mode; create in Task 9 |
| Webhook endpoint(s) | absent (`webhookEndpoints.list` is empty) | exact URLs, selected events and SDK API version | Test Mode; local smoke in Task 9; live endpoint deferred |

The pinned `stripe@22.6.2` SDK reports API version `2026-08-26.dahlia`.
The preview webhook endpoint must use that version.

## Binary acceptance matrix

```text
GREEN-CODE: no Stripe path imports or calls n8n.
GREEN-STATE: UI success never activates a plan; signed webhook is the only billing writer.
GREEN-PREVIEW: a real Test Mode checkout, webhook, Portal session and cleanup pass against Neon preview.
GREEN-PRODUCTION-SCHEMA: the exact reviewed migration passes in Neon production while all billing rows remain empty.
DEFERRED-LIVE: live keys, Prices and webhook endpoint wait for the Cloudflare Worker deployment.
```

Every gate is binary. A partial checkout or a successful redirect without a verified webhook is not a pass. Live activation remains outside Phase 7 until the Cloudflare Worker is deployed.
