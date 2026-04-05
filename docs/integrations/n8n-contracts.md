# n8n Contracts

Stable reference for the rebuilt n8n workflow endpoints.

## Contract Conventions

- All app-facing routes use the shared app auth secret unless otherwise noted.
- Asaas setup uses `x-vapt-webhook-key` as the public request header.
- Provider webhook routes are public but must validate provider-specific secrets or tokens.
- Admin routes are intended for operational checks and safe re-runs.
- Error responses should normalize to the error codes listed in the section below.

## Public App Endpoints

### `POST /asaas/setup`

Purpose:
- Validate the restaurant's Asaas key.
- Register the required webhook if it is missing.
- Persist setup metadata in Supabase.

Headers:
- `x-vapt-webhook-key`

Body:
```json
{
  "restaurant_id": "uuid",
  "asaas_api_key": "string"
}
```

Success response:
```json
{
  "valid": true,
  "webhook_registered": true,
  "webhook_id": "wh_123",
  "setup_status": "ready",
  "message": "Asaas configurado com sucesso"
}
```

### `POST /asaas/pix/create`

Purpose:
- Create a Pix payment for an order through Asaas.
- Return QR/payload data for the frontend.

Expected behavior:
- Verify app auth.
- Load the restaurant and order.
- Fail when Asaas is not configured.
- Persist payment metadata on the order.

### `POST /stripe/subscription/create`

Purpose:
- Create the initial Stripe subscription for a restaurant.

Expected behavior:
- Verify app auth.
- Load the restaurant.
- Resolve or create the Stripe customer.
- Persist Stripe customer and subscription identifiers.

### `POST /stripe/subscription/change`

Purpose:
- Change an active subscription to another plan.

Expected behavior:
- Verify app auth.
- Load the current subscription.
- Update the subscription item to the target plan.

### `POST /stripe/subscription/cancel`

Purpose:
- Cancel an active Stripe subscription.

Expected behavior:
- Verify app auth.
- Cancel the subscription.
- Persist cancellation metadata in `restaurants`.

### `GET /stripe/subscription/status`

Purpose:
- Read the restaurant's billing state from Supabase.

Expected behavior:
- Return the normalized billing status only.

### `POST /ingest/push-subscription`

Purpose:
- Persist a push subscription for operational ingest.

Expected behavior:
- Verify app auth.
- Upsert the push subscription record.

### `POST /ingest/order-feedback`

Purpose:
- Persist order feedback for operational ingest.

Expected behavior:
- Verify app auth.
- Upsert feedback safely.

## Provider Endpoints

### `POST /asaas/webhook`

Purpose:
- Receive Asaas payment lifecycle events.

Expected behavior:
- Validate the stored webhook token.
- Process only relevant payment events.
- Derive `order_id` from `externalReference`.
- Upsert a deduplicated provider event record.
- Update order payment state idempotently.

### `POST /stripe/webhook`

Purpose:
- Receive Stripe billing lifecycle events.

Expected behavior:
- Verify the Stripe signature.
- Process supported invoice and subscription events.
- Upsert a deduplicated provider event record.
- Update billing state idempotently.

## Internal Admin Endpoints

### `POST /asaas/setup/refresh`

Purpose:
- Re-run Asaas validation and setup safely.

Expected behavior:
- Recheck the stored restaurant configuration.
- Reuse the setup flow without mutating unrelated state.

### `GET /asaas/setup/status`

Purpose:
- Read the current Asaas setup metadata from `restaurants`.

Expected behavior:
- Return the persisted setup fields for the restaurant.

### `GET /stripe/health`

Purpose:
- Return billing health diagnostics without mutation.

Expected behavior:
- Report Stripe connectivity or configuration status.

## Normalized Error Codes

- `unauthorized`
- `invalid_configuration`
- `provider_unreachable`
- `payment_creation_failed`
- `subscription_change_failed`
- `subscription_cancel_failed`
- `not_found`
- `duplicate_event`

## Notes

- Public app routes are the contract surface for the frontend and n8n workflow callers.
- Provider routes should remain small, idempotent, and audit-friendly.
- Admin routes are for operators and smoke checks, not end-user flows.
