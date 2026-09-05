begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

create temporary table restaurant_entitlement_results (
  sequence integer not null,
  result text not null
) on commit drop;

grant insert on restaurant_entitlement_results to authenticated, anon;

insert into restaurant_entitlement_results select 0, plan(18);

insert into restaurant_entitlement_results select 1, has_function(
  'public',
  'get_restaurant_creation_entitlement',
  array['uuid'],
  'restaurant creation entitlement RPC exists'
);
insert into restaurant_entitlement_results select 2, function_returns(
  'public',
  'get_restaurant_creation_entitlement',
  array['uuid'],
  'setof record',
  'restaurant creation entitlement returns a capability record'
);
insert into restaurant_entitlement_results select 3, ok(
  has_function_privilege('authenticated', 'public.get_restaurant_creation_entitlement(uuid)', 'execute'),
  'authenticated users can inspect their creation capability'
);
insert into restaurant_entitlement_results select 4, ok(
  not has_function_privilege('anon', 'public.get_restaurant_creation_entitlement(uuid)', 'execute'),
  'anonymous users cannot inspect creation capability'
);
insert into restaurant_entitlement_results select 5, is(public.get_plan_max_restaurants('starter'), 1, 'Starter allows one restaurant');
insert into restaurant_entitlement_results select 6, is(public.get_plan_max_restaurants('pro'), 1, 'Pro allows one restaurant');
insert into restaurant_entitlement_results select 7, is(public.get_plan_max_restaurants('business'), 25, 'Business allows twenty five restaurants');

insert into auth.users (id, email) values
  ('17171717-1717-4171-8171-171717171701', 'owner-entitlement@vapt.test'),
  ('17171717-1717-4171-8171-171717171702', 'admin-entitlement@vapt.test'),
  ('17171717-1717-4171-8171-171717171703', 'staff-entitlement@vapt.test'),
  ('17171717-1717-4171-8171-171717171704', 'outsider-entitlement@vapt.test');

insert into public.organizations (id, name, created_by) values
  ('27272727-2727-4272-8272-272727272701', 'Entitlement Org', '17171717-1717-4171-8171-171717171701');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('27272727-2727-4272-8272-272727272701', '17171717-1717-4171-8171-171717171701', 'owner', 'active'),
  ('27272727-2727-4272-8272-272727272701', '17171717-1717-4171-8171-171717171702', 'admin', 'active'),
  ('27272727-2727-4272-8272-272727272701', '17171717-1717-4171-8171-171717171703', 'staff', 'active');

insert into public.organization_subscriptions (organization_id, plan_type, plan_status)
values ('27272727-2727-4272-8272-272727272701', 'business', 'active')
on conflict (organization_id) do update set plan_type = excluded.plan_type, plan_status = excluded.plan_status;

set local role authenticated;
select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171701', true);
insert into restaurant_entitlement_results select 8, results_eq(
  $$select can_create, role, plan_type, current_restaurants, max_restaurants, reason from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')$$,
  $$values (true, 'owner'::text, 'business'::text, 0, 25, null::text)$$,
  'owner can create within the Business limit'
);

select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171702', true);
insert into restaurant_entitlement_results select 9, ok(
  (select can_create from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')),
  'admin can create within the plan limit'
);

select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171703', true);
insert into restaurant_entitlement_results select 10, results_eq(
  $$select can_create, reason from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')$$,
  $$values (false, 'role_denied'::text)$$,
  'staff cannot create restaurants'
);

select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171704', true);
insert into restaurant_entitlement_results select 11, results_eq(
  $$select can_create, reason from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')$$,
  $$values (false, 'membership_required'::text)$$,
  'non-members cannot create restaurants'
);

reset role;
insert into public.restaurants (id, owner_id, organization_id, name, slug, onboarding_completed)
select gen_random_uuid(), '17171717-1717-4171-8171-171717171701', '27272727-2727-4272-8272-272727272701', 'Unit ' || value, 'entitlement-unit-' || value, true
from generate_series(1, 25) as value;

set local role authenticated;
select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171701', true);
insert into restaurant_entitlement_results select 12, results_eq(
  $$select can_create, current_restaurants, max_restaurants, reason from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')$$,
  $$values (false, 25, 25, 'plan_limit'::text)$$,
  'owner receives an explicit plan limit result'
);
insert into restaurant_entitlement_results select 13, throws_ok(
  $$insert into public.restaurants (owner_id, organization_id, name, slug) values ('17171717-1717-4171-8171-171717171701', '27272727-2727-4272-8272-272727272701', 'Unit 26', 'entitlement-unit-26')$$,
  'P0001',
  'organization restaurant limit reached',
  'the trigger rejects restaurants beyond the plan limit'
);
insert into restaurant_entitlement_results select 14, throws_ok(
  $$select * from public.save_onboarding_draft('Denied Unit', 'denied-unit', 0, null, '27272727-2727-4272-8272-272727272701', null, '#0ea573', '#1e293b', 10)$$,
  'P0001',
  'organization restaurant limit reached',
  'onboarding cannot bypass the organization limit'
);

select set_config('request.jwt.claim.sub', '17171717-1717-4171-8171-171717171703', true);
insert into restaurant_entitlement_results select 15, throws_ok(
  $$select * from public.save_onboarding_draft('Staff Unit', 'staff-unit', 0, null, '27272727-2727-4272-8272-272727272701', null, '#0ea573', '#1e293b', 10)$$,
  '42501',
  'organization access denied',
  'staff cannot create through onboarding'
);

select set_config('request.jwt.claim.sub', '', true);
insert into restaurant_entitlement_results select 16, throws_ok(
  $$select * from public.get_restaurant_creation_entitlement('27272727-2727-4272-8272-272727272701')$$,
  '42501',
  'authentication required',
  'the capability RPC requires authentication'
);

reset role;
insert into restaurant_entitlement_results select 17, ok(
  position('for update' in lower(pg_get_functiondef('public.enforce_restaurant_entitlement()'::regprocedure))) > 0,
  'entitlement enforcement serializes organization creation'
);
insert into restaurant_entitlement_results select 18, ok(
  position('owner' in lower(pg_get_functiondef('public.get_restaurant_creation_entitlement(uuid)'::regprocedure))) > 0
  and position('admin' in lower(pg_get_functiondef('public.get_restaurant_creation_entitlement(uuid)'::regprocedure))) > 0,
  'the capability RPC checks organization roles'
);

insert into restaurant_entitlement_results select 19, finish();

select sequence, result
from restaurant_entitlement_results
order by sequence;

rollback;
