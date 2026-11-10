# n8n contracts

Reference for the remaining API-to-n8n integration boundary. Browser clients do
not call n8n and n8n is not an application database writer.

## Boundary

- The Vapt API authenticates the user, verifies restaurant ownership and writes
  application state to Neon.
- n8n may perform external provider calls only. It must not receive Supabase
  credentials, call PostgREST or persist application rows.
- Push subscriptions, order feedback and Stripe subscription status are handled
  directly by the Vapt API. The retired n8n `/ingest/*` and Stripe status workflows
  are not part of the active n8n contract.
- Subscription operations use the API-to-n8n app secret. Health uses the admin
  secret, while webhook forwarding preserves the verified provider signature.

## Stripe provider operations

### `POST /stripe/subscription/create`

Creates the initial Stripe subscription. The API sends only trusted values:

```json
{
  "restaurant_id": "uuid",
  "email": "authenticated-user@example.com",
  "plan_type": "starter|pro|business",
  "price_id": "server-configured Stripe price ID"
}
```

The `price_id` is selected from `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` or
`STRIPE_PRICE_BUSINESS`; the browser cannot provide or override it. The response
must contain non-empty `subscriptionId` and `customerId`, a boolean
`autoCharged`, and a non-empty `clientSecret` when confirmation is required.

### `POST /stripe/subscription/change`

```json
{
  "restaurant_id": "uuid",
  "target_plan_type": "starter|pro|business",
  "target_price_id": "server-configured Stripe price ID"
}
```

The response plan must exactly match `target_plan_type`; otherwise the API
rejects it and does not persist the entitlement.

### `POST /stripe/subscription/cancel`

```json
{
  "restaurant_id": "uuid"
}
```

The response must identify the subscription and report `canceled` or
`cancelled`. The API persists cancellation only for the authenticated owner.

### `POST /stripe/webhook`

Compatibility forwarding contract for a Stripe-signed raw webhook. Any n8n
consumer must treat the event as an external-integration hook only and must not
write application state. The API verifies the signature and reserves the event
before forwarding it.

## Operational endpoint

### `GET /stripe/health`

Returns Stripe connectivity/configuration diagnostics without mutation.

## Retired contracts

The following workflow contracts are retired and must not be restored as data
writers:

- `/stripe/subscription/status`
- `/ingest/push-subscription`
- `/ingest/order-feedback`
- all Asaas n8n setup/payment/webhook operations

The legacy Asaas export remains only as a non-runtime historical reference. See
`docs/integrations/n8n/README.md` for the repository guard and retirement record.

## Production gate still open

Real billing must remain disabled until a separate Stripe lifecycle task proves
direct, idempotent Neon reconciliation for subscription/invoice webhooks and
propagates an idempotency key through n8n to Stripe. This local data/auth cutover
does not claim that production billing gate.
