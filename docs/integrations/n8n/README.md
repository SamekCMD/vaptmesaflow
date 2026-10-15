# n8n integration boundary

The Vapt API is the only owner of application persistence in Neon. n8n may call
external providers, but an operational workflow must not write application rows
through Supabase credentials or PostgREST.

## Current boundary

- Push subscriptions are persisted by the authenticated API route
  `POST /ingest/push-subscription`. The API derives the restaurant from the
  Better Auth session and upserts by endpoint in Neon.
- Order feedback is persisted by
  `PUT /public/orders/:orderId/feedback`, authenticated with
  `X-Vapt-Order-Token`. The compatibility route `POST /ingest/order-feedback`
  delegates to the same token-authenticated service and ignores browser-supplied
  restaurant identity and timestamps.
- Stripe create/change/cancel calls may still use n8n for the external Stripe
  interaction. The browser sends only the requested plan; the API derives the
  authenticated email and resolves the trusted Stripe price ID from server-side
  configuration. After a correlated upstream response, the API persists the
  returned billing state in Neon with both `restaurant_id` and `owner_id` in the
  update predicate. A Neon write failure is returned as an error, never as local
  success. Subscription status is read directly from Neon.

## Retired versioned workflows

The following writer exports were removed from the repository on 2026-09-26:

- `stripe/Vapt Stripe.json`
- `ingest/Vapt Ingest.json`

They wrote operational rows through Supabase/PostgREST and must not be imported
as active workflows. Importing, disabling, or editing workflows in the remote
n8n UI was intentionally not part of this local cutover.

## Legacy Asaas reference

`asaas/Vapt Asaas.json` remains only as a legacy, non-runtime reference. It
contains Supabase nodes and is not approved for activation or import. The current
API runtime does not register Asaas n8n operations. Any future Asaas restoration
must first move persistence behind owner-scoped API/Neon repositories and add a
separate migration plan.

## Verification

The frontend test `src/test/n8n-operational-writers.test.ts` guards the active
Stripe/ingest directories and the browser n8n client against Supabase,
service-role, and `/rest/v1` persistence dependencies.
