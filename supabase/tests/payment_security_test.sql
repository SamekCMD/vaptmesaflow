begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(8);

select ok(
  not has_table_privilege('anon', 'public.restaurants', 'select'),
  'anon cannot select restaurant rows directly'
);

select ok(
  not has_table_privilege('anon', 'public.payment_provider_accounts', 'select'),
  'anon cannot select provider account rows'
);

select ok(
  not has_column_privilege('anon', 'public.payment_provider_accounts', 'access_token_encrypted', 'select'),
  'anon cannot read encrypted provider access tokens'
);

select ok(
  not exists (
    select 1
    from information_schema.columns as columns
    where columns.table_schema = 'public'
      and columns.table_name = 'restaurants'
      and columns.column_name ~* '(secret|token|credential)'
      and has_column_privilege(
        'anon',
        'public.restaurants',
        columns.column_name,
        'select'
      )
  ),
  'anon cannot read credential-like fields from restaurants'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_public_restaurant_by_slug(text)',
    'execute'
  ),
  'anon can execute the public restaurant lookup'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_public_restaurant_by_slug(text)',
    'execute'
  ),
  'authenticated users can execute the public restaurant lookup'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
      and policyname = 'organization_members_select_restaurants'
  ),
  'the organization membership select policy remains available'
);

select ok(
  pg_get_function_result(
    'public.get_public_restaurant_by_slug(text)'::regprocedure
  ) !~* '(secret|token|password|credential)',
  'the public lookup return type excludes sensitive fields'
);

select * from finish();

rollback;
