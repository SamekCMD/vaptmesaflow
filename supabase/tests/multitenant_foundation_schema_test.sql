begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(16);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organizations'
  ),
  'organizations table exists'
);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organization_members'
  ),
  'organization_members table exists'
);

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'organization_subscriptions'
  ),
  'organization_subscriptions table exists'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurants'
      and column_name = 'organization_id'
      and is_nullable = 'NO'
  ),
  'restaurants.organization_id exists and is required'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_organization_id_fkey'
  ),
  'restaurants.organization_id has a foreign key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_role_check'
  ),
  'organization member role constraint exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_status_check'
  ),
  'organization member status constraint exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'organization_members_user_id_idx'
  ),
  'organization_members user index exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'restaurants_organization_id_idx'
  ),
  'restaurants organization index exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'is_organization_member'
  ),
  'is_organization_member helper exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'has_organization_role'
  ),
  'has_organization_role helper exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'get_plan_max_restaurants'
  ),
  'plan entitlement helper exists'
);

select is(
  public.get_plan_max_restaurants('starter'),
  1,
  'starter plan entitlement is limited to one restaurant'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.restaurants'::regclass
      and tgname = 'ensure_restaurant_organization_id'
  ),
  'restaurants are auto-assigned to an organization'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.restaurants'::regclass
      and tgname = 'enforce_restaurant_entitlement'
  ),
  'restaurant inserts enforce organization entitlements'
);

select ok(
  pg_get_function_result(
    'public.get_public_restaurant_by_slug(text)'::regprocedure
  ) !~* '(asaas|stripe|webhook|secret|token)',
  'the public restaurant lookup excludes sensitive provider fields'
);

select * from finish();

rollback;
