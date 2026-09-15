begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

create temporary table phase7_context (
  fixture text primary key,
  user_id uuid not null,
  organization_id uuid not null,
  restaurant_id uuid not null
) on commit drop;

create temporary table phase7_results (
  sequence integer not null,
  result text not null
) on commit drop;

insert into phase7_context (fixture, user_id, organization_id, restaurant_id) values
  ('tenant_a', '71000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001'),
  ('tenant_b', '71000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002');

insert into auth.users (id, aud, role, email, created_at, updated_at)
select
  user_id,
  'authenticated',
  'authenticated',
  fixture || '@phase7.vapt.test',
  now(),
  now()
from phase7_context;

insert into public.organizations (id, name, created_by)
select organization_id, 'Phase 7 ' || fixture, user_id
from phase7_context;

insert into public.organization_members (organization_id, user_id, role, status)
select organization_id, user_id, 'owner', 'active'
from phase7_context;

insert into public.restaurants (
  id,
  owner_id,
  organization_id,
  name,
  slug,
  total_tables,
  max_tables,
  local_enabled,
  delivery_enabled
)
select
  restaurant_id,
  user_id,
  organization_id,
  'Phase 7 ' || fixture,
  'phase7-' || replace(fixture, '_', '-'),
  10,
  10,
  true,
  false
from phase7_context;

grant select on phase7_context to authenticated, anon;
grant insert on phase7_results to authenticated, anon;

insert into phase7_results values (0, plan(12));

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into phase7_results
select 1, is(
  (select count(*)::integer from public.restaurants),
  1,
  'tenant A can read only its restaurant through RLS'
);

insert into phase7_results
select 2, is(
  (
    select count(*)::integer
    from public.restaurants
    where id = '73000000-0000-4000-8000-000000000002'
  ),
  0,
  'tenant A cannot read tenant B restaurant'
);

insert into phase7_results
select 3, ok(
  public.can_manage_restaurant_storage_object(
    'restaurant-assets',
    'organizations/72000000-0000-4000-8000-000000000001/restaurants/73000000-0000-4000-8000-000000000001/branding/logo.png'
  ),
  'tenant A can manage its scoped restaurant asset'
);

insert into phase7_results
select 4, ok(
  not public.can_manage_restaurant_storage_object(
    'restaurant-assets',
    'organizations/72000000-0000-4000-8000-000000000002/restaurants/73000000-0000-4000-8000-000000000002/branding/logo.png'
  ),
  'tenant A cannot manage tenant B restaurant asset'
);

insert into phase7_results
select 5, ok(
  not public.can_manage_restaurant_storage_object(
    'menu-images',
    'organizations/72000000-0000-4000-8000-000000000002/restaurants/73000000-0000-4000-8000-000000000002/products/product.png'
  ),
  'tenant A cannot manage tenant B product image'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

insert into phase7_results
select 6, is(
  (
    select count(*)::integer
    from public.get_public_restaurant_by_slug('phase7-tenant-a')
  ),
  1,
  'anonymous public restaurant lookup still works'
);

reset role;

insert into phase7_results
select 7, ok(
  not has_table_privilege('anon', 'public.restaurants', 'select'),
  'anonymous users cannot select restaurant rows directly'
);

insert into phase7_results
select 8, ok(
  not has_table_privilege('anon', 'public.organization_subscriptions', 'select'),
  'anonymous users cannot read organization billing rows'
);

insert into phase7_results
select 9, ok(
  not has_table_privilege('anon', 'public.payment_provider_accounts', 'select'),
  'anonymous users cannot read payment provider accounts'
);

insert into phase7_results
select 10, ok(
  not has_column_privilege(
    'anon',
    'public.payment_provider_accounts',
    'access_token_encrypted',
    'select'
  ),
  'anonymous users cannot read encrypted provider access tokens'
);

insert into phase7_results
select 11, ok(
  not has_column_privilege(
    'anon',
    'public.payment_provider_accounts',
    'refresh_token_encrypted',
    'select'
  ),
  'anonymous users cannot read encrypted provider refresh tokens'
);

insert into phase7_results
select 12, ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurant_public_profiles'
      and column_name in (
        'owner_id',
        'public_access_token_hash',
        'access_token_encrypted',
        'refresh_token_encrypted'
      )
  ),
  'public restaurant projection excludes billing and provider credentials'
);

insert into phase7_results
select 13, finish();

select sequence, result
from phase7_results
order by sequence;

rollback;
