# n8n Imports

Current workflow set:
- Asaas
- Stripe
- Ingest

## Suggested rollout order
1. Apply Supabase migrations
2. Import Vapt Asaas
3. Import Vapt Stripe
4. Import Vapt Ingest
5. Configure credentials and secrets
6. Run manual smoke tests for each endpoint
7. Only then update the frontend contracts

Supabase migrations required before import/testing:
- `supabase/migrations/20260404_add_provider_workflow_state.sql`
- `supabase/migrations/20260404_create_push_subscriptions.sql`

## Smoke tests
- Asaas setup succeeds with valid key
- Asaas setup fails clearly with invalid key
- Pix creation returns QR and payload
- Asaas webhook updates order once
- Stripe subscription create returns normalized response
- Stripe plan change works
- Stripe cancellation works
- Stripe webhook updates billing state once
- Push ingest persists record
- Feedback ingest persists record

## Vapt Asaas

Workflow export:
- `docs/integrations/n8n/asaas/Vapt Asaas.json`

Required credentials:
- Supabase service credential
- Asaas access through per-restaurant API key

Required secrets:
- app endpoint secret
- setup endpoint secret for `x-vapt-webhook-key`
- admin endpoint secret

Expected headers:
- `POST /asaas/setup`: `x-vapt-webhook-key`
- `POST /asaas/pix/create`: `x-vapt-app-key`
- `POST /asaas/setup/refresh`: `x-vapt-admin-key`
- `GET /asaas/setup/status`: `x-vapt-admin-key`
- `POST /asaas/webhook`: `asaas-access-token`

Expected environment variables:
- `VAPT_SUPABASE_URL`
- `VAPT_SUPABASE_SERVICE_KEY`
- `VAPT_APP_ENDPOINT_SECRET`
- `VAPT_WEBHOOK_SETUP_SECRET`
- `VAPT_ADMIN_ENDPOINT_SECRET`
- `VAPT_N8N_WEBHOOK_BASE_URL`

Manual post-import checks:
- webhook URLs
- auth token handling
- restaurant write fields
- order payment metadata fields expected by the Pix branch

Implementation notes:
- The setup and admin refresh branches share the same validation, webhook registration, and persistence chain.
- The Pix branch uses the approved deterministic generic Asaas customer strategy keyed by `vapt-restaurant-<restaurant_id>`.
- The webhook branch upserts into `payment_provider_events` before applying the idempotent order transition to `payment_status = CONFIRMED` and `status = paid`.

## Vapt Stripe

Workflow export:
- `docs/integrations/n8n/stripe/Vapt Stripe.json`

Required credentials:
- Supabase service credential
- Stripe API credentials

Required secrets:
- app endpoint secret
- admin endpoint secret

Expected headers:
- `POST /stripe/subscription/create`: `x-vapt-app-key`
- `POST /stripe/subscription/change`: `x-vapt-app-key`
- `POST /stripe/subscription/cancel`: `x-vapt-app-key`
- `GET /stripe/subscription/status`: `x-vapt-app-key`
- `POST /stripe/webhook`: Stripe signature headers
- `GET /stripe/health`: `x-vapt-admin-key`

Expected environment variables:
- `VAPT_SUPABASE_URL`
- `VAPT_SUPABASE_SERVICE_KEY`
- `VAPT_APP_ENDPOINT_SECRET`
- `VAPT_ADMIN_ENDPOINT_SECRET`
- `STRIPE_WEBHOOK_SIGNING_SECRET`

Manual post-import checks:
- subscription create returns normalized payload
- plan change supports upgrade and downgrade flows
- cancellation persists restaurant cancellation metadata
- webhook verifies signature and upserts billing events
- health endpoint returns diagnostics without mutating data

Implementation notes:
- The workflow family keeps Stripe isolated from Asaas and uses Supabase as the persisted billing source of truth.
- The webhook branch writes to `billing_provider_events` before applying idempotent billing updates to the restaurant record.

## Vapt Ingest

Workflow export:
- `docs/integrations/n8n/ingest/Vapt Ingest.json`

Required credentials:
- Supabase service credential

Required secrets:
- app endpoint secret

Expected headers:
- `POST /ingest/push-subscription`: `x-vapt-app-key`
- `POST /ingest/order-feedback`: `x-vapt-app-key`

Expected environment variables:
- `VAPT_SUPABASE_URL`
- `VAPT_SUPABASE_SERVICE_KEY`
- `VAPT_APP_ENDPOINT_SECRET`

Manual post-import checks:
- push subscription upsert succeeds
- order feedback upsert succeeds
- responses stay normalized and idempotent

Implementation notes:
- The ingest workflow family handles operational data only and should remain independent from payment provider flows.
