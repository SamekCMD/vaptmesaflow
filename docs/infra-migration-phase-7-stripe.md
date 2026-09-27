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

## Local code gate and independent review

Tasks 1–7 replaced billing forwarding with the official SDK, hosted Checkout,
Customer Portal, signed local webhooks and Neon event/outbox persistence. Push
registration uses the cookie-authenticated API directly; n8n runtime/config is removed.

The fresh whole-branch review found four Important issues, reproduced RED and
corrected GREEN: Customer-only trials retain Checkout via safe `canStartCheckout`;
in-flight event claims return retryable 503; email intents deduplicate by invoice or
Subscription resource as well as event; locked canonical state is not discarded
because of application-host clock skew. Migration 005 is still unapplied at this gate;
its new resource-key constraint changes the preparation hash before promotion.

Current verification: API 396/396 tests and strict build; frontend 135/135 tests and
production build; both diff checks pass. The prescribed root TypeScript command
passes but does not check the app project. The real app project still has 21 existing
diagnostics and zero new diagnostics compared with the pre-billing commit. These
auth/order/menu baseline repairs are not claimed complete here.

One Minor remains deferred: a lost Stripe Checkout response or a database rollback
followed by a fresh browser attempt key can leave an orphan Test Session. No duplicate
charging was demonstrated. Durable server-side attempt recovery is follow-up hardening.
Queue email delivery and Worker/Live deployment remain later-phase gates.

## Preview evidence — Task 9

Target: Neon project `dawn-morning-27332079`, preview branch
`br-rough-dew-b6ydeygb`, database `vapt`. Production was not used for this smoke.
The Stripe verifier first failed because `billing_email_outbox` was absent.
Only the reviewed migration 005 was then applied; all five verifiers and the
rollback-only PostgreSQL smoke passed.

| File | SHA-256 of the applied/verified bytes |
| --- | --- |
| `005_stripe_billing.sql` | `8a91fb9d530709d04682898734c83f08f5dec200904d948c7460d634a7a69c94` |
| `verify-baseline.sql` | `c48f6b5b4bfa9302f3e1baacc2c96d3de6c80ebc004eecad300de68a6400468b` |
| `verify-routines.sql` | `0841b6b4fd051d19dccd69efd72787d0b62dff89c7def62819b82796ffb60208` |
| `verify-integrity.sql` | `9af707858ca89b7580fc2390f2eb31e4518f3794bb977e72a56c4dfd1a49ba71` |
| `verify-better-auth.sql` | `5f148fc06fc194d199d47fa8a48183193b8496cde7235b701d8ed937154779ab` |
| `verify-stripe-billing.sql` | `d2fb6e41cf48dfc91add36c6ff4546d9e9ee7fccc7e4f2f2740eab6d366473cd` |

The isolated Test Mode sandbox remains `acct_1UKK2EQYNWCekS7F`.
The following persistent test catalog was created through the official SDK and
retrieved again to verify active monthly BRL Prices and exact amounts:

| Plan | Product | Price | Monthly cents |
| --- | --- | --- | --- |
| Starter | `prod_VL23xqPaemn63m` | `price_1UKLz6QYNWCekS7FogRBzEO9` | 9700 |
| Pro | `prod_VL23dFAv9gdNcp` | `price_1UKLz7QYNWCekS7FA9lBwZEd` | 19700 |
| Business | `prod_VL230OpEVdXFEs` | `price_1UKLz8QYNWCekS7Fgz31Vrqd` | 34700 |

Portal configuration `bpc_1UKLz8QYNWCekS7FIAhwaL1w` is active in Test Mode.
Its retrieved configuration enables payment-method updates, invoice history,
switching among these three Prices with prorations and cancel-at-period-end.
The products list was explicitly expanded during retrieval. No Live resource or
public webhook destination was created. Official Stripe CLI forwarding reached
only the local API, using the pinned SDK API version `2026-08-26.dahlia`.

Real PostgreSQL checks passed: two concurrent claims yielded exactly one claim
and one in-flight result; stale attempt fencing held; a failed transaction rolled
back its email intent; retry advanced the attempt; two different event IDs for
one invoice produced exactly one business-resource-owned email intent.

The hosted Test Checkout completed with standard synthetic Stripe test data.
Two concurrent authenticated Checkout calls reused one pending Session; the
restaurant stayed trial before payment. The signed webhook flow then persisted
Pro/active, the Customer and Subscription, cleared pending Checkout and created
exactly one activation intent. Authenticated status contained no Stripe IDs.
Replaying the processed invoice returned success without another state write.

Non-secret disposable object evidence:

- Customer: `cus_VL2AGApM83HeSA`.
- Subscription: `sub_1UKM7bQYNWCekS7FB7pUIdnV`.
- Checkout: `cs_test_a1ZdTQB7Qj4ubmgNwACMmOOHZt7kdVmKgVAK7en0XG4PQJv25ZEHUpx8Vk`.
- Checkout event: `evt_1UKM7cQYNWCekS7FZH4SFhpy`.
- Initial paid invoice event: `evt_1UKM7cQYNWCekS7FBO3j30mc`.

The API-created Portal opened successfully and displayed the paid subscription.
Its Test Mode UI scheduled cancellation for the period end (27 October 2026).
The resulting `customer.subscription.updated` event
`evt_1UKQ9IQYNWCekS7FwgOJ3anN` was delivered and acknowledged. The first
post-action check exposed an actual Stripe response shape omitted by local
fixtures: `cancel_at` matched the item's `current_period_end`, while
`cancel_at_period_end` was false. The pre-fix API kept the subscription active
but did not mark its scheduled cancellation in Neon. A new real-SDK gateway
regression failed RED; a narrow adapter change then passed GREEN (API 397/397
tests, strict build). The exact disposable provider event was re-claimed for
retry and replayed with a test signature against the rebuilt local API. Neon
then recorded cancellation at period end, retained active entitlement until
then, and acknowledged a duplicate without rewriting state. This correction
is API commit `5bcf3de`.

Cleanup canceled the synthetic Test Subscription, deleted its Test Customer,
and removed only the corresponding synthetic Better Auth, restaurant, event
and outbox rows in preview. All seven counted tables ended at zero; all five
verifiers passed again after cleanup. The three Test Products/Prices and
Portal configuration intentionally remain for preview; no Live resource was
changed. GREEN-PREVIEW is established by the full lifecycle and cleanup,
not merely by the Checkout redirect or the first Portal screen.
