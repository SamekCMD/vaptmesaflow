begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

create temporary table onboarding_atomic_context (
  fixture text primary key,
  user_id uuid not null,
  organization_id uuid,
  restaurant_id uuid,
  initial_trial_ends_at timestamptz
) on commit drop;

create temporary table onboarding_atomic_results (
  sequence integer not null,
  result text not null
) on commit drop;

insert into onboarding_atomic_context (fixture, user_id, organization_id, restaurant_id)
values
  ('success', gen_random_uuid(), gen_random_uuid(), gen_random_uuid()),
  ('intruder', gen_random_uuid(), null, null);

insert into onboarding_atomic_context (fixture, user_id, organization_id, restaurant_id)
select 'failure', context.user_id, gen_random_uuid(), gen_random_uuid()
from onboarding_atomic_context as context
where context.fixture = 'success';

insert into auth.users (id, aud, role, email, created_at, updated_at)
select distinct
  context.user_id,
  'authenticated',
  'authenticated',
  context.user_id::text || '@onboarding.test',
  now(),
  now()
from onboarding_atomic_context as context;

insert into public.organizations (id, name, created_by)
select context.organization_id, 'Atomic ' || context.fixture, context.user_id
from onboarding_atomic_context as context
where context.organization_id is not null;

insert into public.organization_members (organization_id, user_id, role, status)
select context.organization_id, context.user_id, 'owner', 'active'
from onboarding_atomic_context as context
where context.organization_id is not null;

insert into public.restaurants (
  id,
  owner_id,
  organization_id,
  name,
  slug,
  total_tables,
  max_tables,
  local_enabled,
  delivery_enabled,
  onboarding_status,
  onboarding_step
)
select
  context.restaurant_id,
  context.user_id,
  context.organization_id,
  'Atomic ' || context.fixture,
  'atomic-' || context.fixture || '-' || left(context.restaurant_id::text, 8),
  10,
  10,
  true,
  false,
  'draft',
  2
from onboarding_atomic_context as context
where context.restaurant_id is not null;

grant select on onboarding_atomic_context to authenticated;
grant insert on onboarding_atomic_results to authenticated;

insert into onboarding_atomic_results values (0, plan(12));

insert into onboarding_atomic_results values (
  1,
  has_function('public', 'finalize_onboarding', array['uuid'], 'finalization RPC exists')
);
insert into onboarding_atomic_results values (
  2,
  ok(
    coalesce(
      has_function_privilege('authenticated', to_regprocedure('public.finalize_onboarding(uuid)'), 'execute'),
      false
    ),
    'authenticated users can finalize onboarding'
  )
);
insert into onboarding_atomic_results values (
  3,
  ok(
    not coalesce(
      has_function_privilege('anon', to_regprocedure('public.finalize_onboarding(uuid)'), 'execute'),
      true
    ),
    'anonymous users cannot finalize onboarding'
  )
);

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from onboarding_atomic_context where fixture = 'intruder'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from onboarding_atomic_context
    where fixture = 'intruder'
  ),
  true
);
set local role authenticated;

insert into onboarding_atomic_results
select 4, throws_ok(
  format(
    'select * from public.finalize_onboarding(%L::uuid)',
    (select restaurant_id from onboarding_atomic_context where fixture = 'success')
  ),
  '42501',
  'onboarding restaurant unavailable',
  'non-members cannot finalize another organization restaurant'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from onboarding_atomic_context where fixture = 'success'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from onboarding_atomic_context
    where fixture = 'success'
  ),
  true
);
set local role authenticated;

insert into onboarding_atomic_results
select 5, lives_ok(
  format(
    'select * from public.finalize_onboarding(%L::uuid)',
    (select restaurant_id from onboarding_atomic_context where fixture = 'success')
  ),
  'an organization owner can finalize a valid draft'
);

reset role;

insert into onboarding_atomic_results
select 6, ok(
  restaurant.onboarding_status = 'complete'
    and restaurant.onboarding_completed
    and restaurant.onboarding_completed_at is not null,
  'completion state and timestamp are persisted by the database'
)
from public.restaurants as restaurant
where restaurant.id = (
  select restaurant_id from onboarding_atomic_context where fixture = 'success'
);

insert into onboarding_atomic_results
select 7, ok(
  preference.current_organization_id = context.organization_id
    and preference.current_restaurant_id = context.restaurant_id,
  'account preferences select the finalized restaurant'
)
from onboarding_atomic_context as context
join public.account_preferences as preference on preference.user_id = context.user_id
where context.fixture = 'success';

insert into onboarding_atomic_results
select 8, ok(
  subscription.plan_type = 'starter'
    and subscription.plan_status = 'trialing'
    and subscription.trial_ends_at > now(),
  'the first completed restaurant starts the organization trial'
)
from onboarding_atomic_context as context
join public.organization_subscriptions as subscription
  on subscription.organization_id = context.organization_id
where context.fixture = 'success';

update onboarding_atomic_context as context
set initial_trial_ends_at = subscription.trial_ends_at
from public.organization_subscriptions as subscription
where context.fixture = 'success'
  and subscription.organization_id = context.organization_id;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from onboarding_atomic_context where fixture = 'success'),
  true
);
set local role authenticated;

insert into onboarding_atomic_results
select 9, lives_ok(
  format(
    'select * from public.finalize_onboarding(%L::uuid)',
    (select restaurant_id from onboarding_atomic_context where fixture = 'success')
  ),
  'repeated finalization returns safely'
);

reset role;

insert into onboarding_atomic_results
select 10, is(
  subscription.trial_ends_at,
  context.initial_trial_ends_at,
  'repeated finalization does not restart the trial'
)
from onboarding_atomic_context as context
join public.organization_subscriptions as subscription
  on subscription.organization_id = context.organization_id
where context.fixture = 'success';

create function pg_temp.fail_onboarding_trial()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced onboarding trial failure' using errcode = 'P0001';
end;
$$;

create trigger fail_onboarding_trial
before insert on public.organization_subscriptions
for each row execute function pg_temp.fail_onboarding_trial();

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from onboarding_atomic_context where fixture = 'failure'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from onboarding_atomic_context
    where fixture = 'failure'
  ),
  true
);
set local role authenticated;

insert into onboarding_atomic_results
select 11, throws_ok(
  format(
    'select * from public.finalize_onboarding(%L::uuid)',
    (select restaurant_id from onboarding_atomic_context where fixture = 'failure')
  ),
  'P0001',
  'forced onboarding trial failure',
  'a secondary failure aborts finalization'
);

reset role;

insert into onboarding_atomic_results
select 12, ok(
  restaurant.onboarding_status = 'draft'
    and not restaurant.onboarding_completed
    and restaurant.onboarding_completed_at is null
    and not exists (
      select 1
      from public.organization_subscriptions as subscription
      where subscription.organization_id = context.organization_id
    )
    and exists (
      select 1
      from public.account_preferences as preference
      where preference.user_id = context.user_id
        and preference.current_restaurant_id = (
          select restaurant_id from onboarding_atomic_context where fixture = 'success'
        )
    ),
  'secondary failure rolls back completion, trial, and account selection'
)
from onboarding_atomic_context as context
join public.restaurants as restaurant on restaurant.id = context.restaurant_id
where context.fixture = 'failure';

insert into onboarding_atomic_results
select 13, finish();

select sequence, result
from onboarding_atomic_results
order by sequence;

rollback;
