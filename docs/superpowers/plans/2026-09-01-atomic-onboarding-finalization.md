# Atomic Onboarding Finalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize a persisted onboarding draft through one authorized, idempotent PostgreSQL transaction.

**Architecture:** Add a dedicated `finalize_onboarding(uuid)` RPC that locks and validates the restaurant, updates account selection, and marks completion last so existing triggers initialize the organization trial in the same transaction. Expose that boundary through the onboarding service and a TanStack mutation; the wizard never updates `restaurants` directly.

**Tech Stack:** PostgreSQL 15, Supabase Auth/PostgREST, pgTAP, TypeScript, Supabase JS, TanStack Query 5, React 18, Vitest, Testing Library.

---

## File Map

- Create `supabase/migrations/20260901004000_finalize_onboarding_atomic.sql`: define and secure the finalization RPC.
- Create `supabase/tests/atomic_onboarding_finalization_test.sql`: exercise authorization, trial creation, idempotency, and rollback.
- Modify `src/features/onboarding/onboarding-service.ts`: add the typed RPC adapter.
- Modify `src/features/onboarding/use-onboarding-draft.ts`: expose the finalization mutation and invalidate canonical account state.
- Modify `src/integrations/supabase/types.ts`: add the generated-style RPC contract.
- Modify `src/test/onboarding-service.test.ts`: verify the finalization payload and returned server state.
- Modify `src/pages/onboarding/OnboardingPage.tsx`: replace the direct restaurant update with the mutation.
- Modify `src/test/onboarding-flow.test.tsx`: verify finalization success, idempotent submission boundary, and failure behavior.

### Task 1: Add the atomic and idempotent database boundary

**Files:**
- Create: `supabase/tests/atomic_onboarding_finalization_test.sql`
- Create: `supabase/migrations/20260901004000_finalize_onboarding_atomic.sql`

- [ ] **Step 1: Write the failing pgTAP contract and behavior tests**

Create a transaction-wrapped suite with temporary result/context tables. Insert two synthetic `auth.users`, two organizations, active owner memberships, one intruder, and two valid draft restaurants. Assert:

```sql
select plan(12);
select has_function('public', 'finalize_onboarding', array['uuid'], 'finalization RPC exists');
select ok(has_function_privilege('authenticated', 'public.finalize_onboarding(uuid)', 'execute'), 'authenticated can finalize');
select ok(not has_function_privilege('anon', 'public.finalize_onboarding(uuid)', 'execute'), 'anonymous cannot finalize');
select throws_ok(
  format('select * from public.finalize_onboarding(%L::uuid)', owner_restaurant_id),
  '42501',
  'onboarding restaurant unavailable',
  'non-members cannot finalize another organization restaurant'
);
```

Set `request.jwt.claims` to the owner and `SET LOCAL ROLE authenticated`, then use `lives_ok` for the first call. Reset the role before inspecting tables. Assert the restaurant is complete, `onboarding_completed_at` is non-null, account preferences select it, and one organization subscription has a server-generated trial end.

Store the first `trial_ends_at`, call the RPC again as the owner, and assert the returned restaurant is unchanged and the trial timestamp is identical.

For rollback, install a trigger scoped to the failure fixture:

```sql
create function pg_temp.fail_onboarding_trial() returns trigger language plpgsql as $$
begin
  raise exception 'forced onboarding trial failure' using errcode = 'P0001';
end;
$$;

create trigger fail_onboarding_trial
before insert on public.organization_subscriptions
for each row execute function pg_temp.fail_onboarding_trial();
```

Use `throws_ok` to invoke finalization, then assert that the failure restaurant remains `draft`, its completion timestamp is null, no subscription exists, and no account preference change survived. Accumulate every TAP line in a temporary results table and return it ordered before `ROLLBACK` so Supabase SQL Editor displays all assertions.

- [ ] **Step 2: Run pgTAP and verify RED**

Run `supabase/tests/atomic_onboarding_finalization_test.sql` in the self-hosted Supabase SQL Editor.

Expected: the function-existence assertion fails because `finalize_onboarding(uuid)` does not exist. Do not apply the migration yet.

- [ ] **Step 3: Implement the minimal finalization RPC**

Create `20260901004000_finalize_onboarding_atomic.sql` with this boundary:

```sql
create function public.finalize_onboarding(p_restaurant_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  onboarding_status text,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant public.restaurants%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select restaurant.* into v_restaurant
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;

  if v_restaurant.id is null
    or not public.has_organization_role(
      v_restaurant.organization_id,
      array['owner', 'admin'],
      v_user_id
    ) then
    raise exception 'onboarding restaurant unavailable' using errcode = '42501';
  end if;

  if v_restaurant.onboarding_status = 'complete' then
    return query
    select restaurant.id, restaurant.organization_id, restaurant.onboarding_status,
      restaurant.onboarding_completed, restaurant.onboarding_completed_at
    from public.restaurants as restaurant
    where restaurant.id = v_restaurant.id;
    return;
  end if;

  if v_restaurant.onboarding_status <> 'draft'
    or length(btrim(v_restaurant.name)) < 2
    or v_restaurant.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (not v_restaurant.local_enabled and not v_restaurant.delivery_enabled)
    or (v_restaurant.local_enabled and v_restaurant.total_tables < 1) then
    raise exception 'onboarding draft is incomplete' using errcode = '22023';
  end if;

  insert into public.account_preferences (
    user_id, current_organization_id, current_restaurant_id
  ) values (
    v_user_id, v_restaurant.organization_id, v_restaurant.id
  ) on conflict (user_id) do update
    set current_organization_id = excluded.current_organization_id,
        current_restaurant_id = excluded.current_restaurant_id,
        updated_at = now();

  update public.restaurants as restaurant
  set onboarding_status = 'complete',
      onboarding_step = greatest(restaurant.onboarding_step, 2)
  where restaurant.id = v_restaurant.id;

  return query
  select restaurant.id, restaurant.organization_id, restaurant.onboarding_status,
    restaurant.onboarding_completed, restaurant.onboarding_completed_at
  from public.restaurants as restaurant
  where restaurant.id = v_restaurant.id;
end;
$$;

revoke all on function public.finalize_onboarding(uuid) from public, anon;
grant execute on function public.finalize_onboarding(uuid) to authenticated;
notify pgrst, 'reload schema';
```

The restaurant update must remain the final write. The existing sync trigger sets completion fields from database time, and its subscription trigger executes atomically within this statement.

- [ ] **Step 4: Run pgTAP and verify GREEN**

Apply the migration, then run `supabase/tests/atomic_onboarding_finalization_test.sql`.

Expected: `1..12`, twelve `ok` lines, and no failure summary.

- [ ] **Step 5: Commit the database boundary**

```bash
git add supabase/migrations/20260901004000_finalize_onboarding_atomic.sql supabase/tests/atomic_onboarding_finalization_test.sql
git commit -m "feat: finalize onboarding atomically"
```

### Task 2: Add the typed frontend finalization adapter

**Files:**
- Modify: `src/features/onboarding/onboarding-service.ts`
- Modify: `src/features/onboarding/use-onboarding-draft.ts`
- Modify: `src/integrations/supabase/types.ts`
- Test: `src/test/onboarding-service.test.ts`

- [ ] **Step 1: Write the failing service test**

Add a test that mocks a server-returned completion timestamp and expects exactly one argument:

```ts
const result = await finalizeOnboarding("rest-1");

expect(supabase.rpc).toHaveBeenCalledWith("finalize_onboarding", {
  p_restaurant_id: "rest-1",
});
expect(result).toEqual({
  id: "rest-1",
  organizationId: "org-1",
  status: "complete",
  completedAt: "2026-09-01T12:00:00.000Z",
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/test/onboarding-service.test.ts`

Expected: FAIL because `finalizeOnboarding` is not exported.

- [ ] **Step 3: Add the service contract**

Add `OnboardingFinalization` and `finalizeOnboarding(restaurantId)` to `onboarding-service.ts`. Call the RPC, throw its error, require one returned row, and map snake_case server fields to the camelCase object in Step 1. Do not generate a timestamp in TypeScript.

- [ ] **Step 4: Add the mutation and generated-style database type**

Add this function entry to `Database['public']['Functions']`:

```ts
finalize_onboarding: {
  Args: { p_restaurant_id: string };
  Returns: {
    id: string;
    organization_id: string;
    onboarding_status: string;
    onboarding_completed: boolean;
    onboarding_completed_at: string | null;
  }[];
};
```

Add `useFinalizeOnboarding()` beside the draft mutation. Its `onSuccess` invalidates `['account-bootstrap']` and `['onboarding-draft', result.id]`.

- [ ] **Step 5: Run the focused test and lint touched files**

Run: `npm test -- src/test/onboarding-service.test.ts`

Run: `npm run lint`

Expected: both commands pass.

- [ ] **Step 6: Commit the frontend adapter**

```bash
git add src/features/onboarding/onboarding-service.ts src/features/onboarding/use-onboarding-draft.ts src/integrations/supabase/types.ts src/test/onboarding-service.test.ts
git commit -m "feat: expose atomic onboarding finalization"
```

### Task 3: Route the wizard through the finalization mutation

**Files:**
- Modify: `src/pages/onboarding/OnboardingPage.tsx`
- Modify: `src/test/onboarding-flow.test.tsx`

- [ ] **Step 1: Replace direct-update expectations with failing RPC tests**

Mock `useFinalizeOnboarding` with `finalizeAsync`. Update the success test to expect:

```ts
expect(finalizeAsync).toHaveBeenCalledOnce();
expect(finalizeAsync).toHaveBeenCalledWith("rest-1");
expect(supabase.from).not.toHaveBeenCalledWith("restaurants");
```

Add a rejected-mutation case that reaches the review step, rejects finalization, and asserts the `Pronto para começar` heading remains visible and the completion choice state is absent.

- [ ] **Step 2: Run the flow test and verify RED**

Run: `npm test -- src/test/onboarding-flow.test.tsx`

Expected: FAIL because the page still calls `restaurants.update` and the finalization hook is unused.

- [ ] **Step 3: Replace the direct update with the RPC mutation**

Import `useFinalizeOnboarding`, instantiate it beside `useSaveOnboardingDraft`, and replace:

```ts
await supabase
  .from("restaurants")
  .update({ onboarding_completed: true })
  .eq("id", restaurant.id);
```

with:

```ts
await finalizeOnboarding.mutateAsync(restaurant.id);
```

Remove the page's Supabase import. Keep draft persistence before finalization, the existing `saving` guard, success screen, and destructive failure toast.

- [ ] **Step 4: Run focused onboarding tests**

Run:

```bash
npm test -- src/test/onboarding-form.test.ts src/test/onboarding-service.test.ts src/test/onboarding-flow.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 5: Commit the wizard integration**

```bash
git add src/pages/onboarding/OnboardingPage.tsx src/test/onboarding-flow.test.tsx
git commit -m "refactor: finalize onboarding through atomic RPC"
```

### Task 4: Verify and publish after database approval

**Files:**
- Modify only if verification exposes a defect in Task 1-3 files.

- [ ] **Step 1: Run the full frontend suite**

Run: `npm test`

Expected: all tests pass; existing React Router and landing-page `act()` warnings may remain.

- [ ] **Step 2: Run lint and production build**

Run: `npm run lint`

Run: `npm run build`

Expected: both pass; the existing chunk-size and browserslist warnings may remain.

- [ ] **Step 3: Confirm self-hosted database evidence**

Record the SQL Editor result from `atomic_onboarding_finalization_test.sql`: twelve assertions, all `ok`, including the forced rollback and unchanged trial timestamp checks.

- [ ] **Step 4: Push only after approval**

```bash
git push origin codex/multitenant-v2
```

Expected: Vercel creates a preview where one click finalizes the existing draft and a repeated request is harmless.
