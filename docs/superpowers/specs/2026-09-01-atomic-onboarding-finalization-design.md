# Atomic Onboarding Finalization Design

## Goal

Replace the frontend's draft-save-plus-update sequence with one database-owned,
atomic, and idempotent onboarding finalization boundary.

## RPC Boundary

Create `public.finalize_onboarding(p_restaurant_id uuid)`. The function is
`SECURITY DEFINER`, has a restricted `search_path`, is executable only by
`authenticated`, and derives the caller exclusively from `auth.uid()`.

The RPC performs these operations in order:

1. Reject unauthenticated callers.
2. Select and lock the restaurant with `FOR UPDATE`.
3. Require an active `owner` or `admin` membership in its organization.
4. Return the same restaurant immediately when onboarding is already complete.
5. Validate the persisted restaurant name, slug, operation mode, and table count
   when local service is enabled.
6. Upsert `account_preferences` to select the finalized organization and restaurant.
7. Set `onboarding_status = 'complete'` last and return the completed restaurant.

The existing onboarding-state trigger synchronizes `onboarding_completed` and
sets `onboarding_completed_at` from database time. Its update also invokes the
existing organization-subscription trigger in the same transaction.

## Trial Semantics

The first completed restaurant continues to start the organization's three-day
Starter trial. `organization_subscriptions.organization_id` remains unique, and
the existing trigger preserves a pre-existing trial end instead of restarting
it. A repeated finalization returns before issuing another completion update.

## Operational Records

No table-session rows or placeholder menu items are created. Cashier tables are
derived from `restaurants.total_tables`, and `table_sessions` are created only
when a table actually opens. `account_preferences` and the organization
subscription are the only required related records at finalization.

## Frontend Integration

Add a typed service function and mutation for `finalize_onboarding`. The final
wizard step persists the latest draft first, then calls the finalization RPC
with the persisted restaurant ID. The page no longer updates the restaurant
table directly. Duplicate clicks remain disabled in the UI, while database
idempotency is the authoritative guarantee.

Expected database errors keep the wizard data intact and leave the user on the
review step. Membership and invalid-state failures use human-readable feedback
without exposing internal database details.

## Transaction And Failure Testing

The pgTAP suite creates isolated organization, membership, and draft fixtures.
It verifies:

- unauthenticated and anonymous callers cannot finalize;
- a non-member cannot finalize another organization's restaurant;
- an owner can finalize a valid draft;
- completion fields and trial timestamps come from the database;
- a second call returns the same restaurant without changing the trial end;
- a forced failure during subscription initialization rolls back account
  preference and restaurant completion changes.

The failure test installs a transaction-scoped trigger that raises while the
subscription row is being created, invokes finalization, then proves the draft
remains incomplete and no subscription was persisted.

## Deployment

The migration only adds the new RPC and permissions, so existing frontend
behavior remains compatible until deployment. After the migration and pgTAP
suite pass on the self-hosted Supabase instance, the frontend may switch to the
RPC without a coordinated database restart.
