begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(17);

select ok(
  exists (
    select 1
    from pg_class
    where oid = 'public.organization_subscriptions'::regclass
      and relrowsecurity
  ),
  'organization_subscriptions has row level security enabled'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_subscriptions'
      and column_name = 'asaas_webhook_token'
  ),
  'organization_subscriptions keeps provider webhook token data private to the table'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
      and policyname = 'organization_members_select_restaurants'
  ),
  'restaurant member select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
      and policyname = 'organization_members_update_restaurants'
  ),
  'restaurant member update policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_subscriptions'
      and policyname = 'organization_members_read_subscriptions'
  ),
  'organization subscription read policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_subscriptions'
      and policyname = 'organization_members_read_subscriptions'
      and qual ilike '%is_organization_member%'
  ),
  'all active organization members can read organization subscription state'
);

select has_table(
  'public',
  'account_preferences',
  'account preferences table exists'
);

select ok(
  exists (
    select 1
    from pg_class
    where oid = 'public.account_preferences'::regclass
      and relrowsecurity
  ),
  'account preferences has row level security enabled'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_preferences'
      and policyname = 'users_read_own_account_preferences'
  ),
  'users can read only their own account preferences'
);

select ok(
  not has_table_privilege('anon', 'public.account_preferences', 'select'),
  'anonymous users cannot read account preferences'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.restaurants'::regclass
      and tgname = 'initialize_organization_subscription_trial'
      and not tgisinternal
  ),
  'completed onboarding initializes the organization trial server-side'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_public_restaurant_by_slug(text)',
    'execute'
  ),
  'anon can still execute the public restaurant lookup'
);

select ok(
  exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'restaurant_public_profiles'
  ),
  'public restaurant projection view exists'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'can_manage_restaurant_storage_object'
  ),
  'storage ownership helper exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'organization_members_insert_menu_images'
  ),
  'storage insert policy is organization scoped'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'organization_members_update_menu_images'
  ),
  'storage update policy is organization scoped'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'organization_members_delete_menu_images'
  ),
  'storage delete policy is organization scoped'
);

select * from finish();

rollback;
