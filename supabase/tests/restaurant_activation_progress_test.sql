begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

create temporary table restaurant_activation_context (
  fixture text primary key,
  user_id uuid not null,
  organization_id uuid not null,
  restaurant_id uuid not null
) on commit drop;

create temporary table restaurant_activation_results (
  sequence integer not null,
  result text not null
) on commit drop;

create temporary table restaurant_activation_finalization (
  restaurant_id uuid not null
) on commit drop;

insert into restaurant_activation_context (
  fixture,
  user_id,
  organization_id,
  restaurant_id
) values
  ('member_a', gen_random_uuid(), gen_random_uuid(), gen_random_uuid()),
  ('member_b', gen_random_uuid(), gen_random_uuid(), gen_random_uuid()),
  ('inactive_a', gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into auth.users (id, aud, role, email, created_at, updated_at)
select
  context.user_id,
  'authenticated',
  'authenticated',
  context.fixture || '-' || left(context.user_id::text, 8) || '@activation.test',
  now(),
  now()
from restaurant_activation_context as context;

insert into public.organizations (id, name, created_by)
select
  context.organization_id,
  'Activation ' || context.fixture,
  context.user_id
from restaurant_activation_context as context;

insert into public.organization_members (organization_id, user_id, role, status)
select
  context.organization_id,
  context.user_id,
  'owner',
  case when context.fixture = 'inactive_a' then 'disabled' else 'active' end
from restaurant_activation_context as context;

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
  context.restaurant_id,
  context.user_id,
  context.organization_id,
  'Activation ' || context.fixture,
  'activation-' || replace(context.fixture, '_', '-') || '-' || left(context.restaurant_id::text, 8),
  10,
  10,
  true,
  false
from restaurant_activation_context as context;

grant select on restaurant_activation_context to authenticated, anon;
grant insert on restaurant_activation_results to authenticated, anon;
grant insert on restaurant_activation_finalization to authenticated;

insert into restaurant_activation_results values (0, plan(28));

insert into restaurant_activation_results values (
  1,
  has_table(
    'public',
    'restaurant_activation_progress',
    'restaurant activation progress table exists'
  )
);

insert into restaurant_activation_results values (
  2,
  columns_are(
    'public',
    'restaurant_activation_progress',
    array['restaurant_id', 'module_key', 'completed_at', 'completed_by'],
    'activation progress exposes only the expected columns'
  )
);

insert into restaurant_activation_results values (
  3,
  col_type_is(
    'public',
    'restaurant_activation_progress',
    'completed_at',
    'timestamp with time zone',
    'completion timestamp uses timestamptz'
  )
);

insert into restaurant_activation_results values (
  4,
  ok(
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'restaurant_activation_progress'
        and column_name = 'completed_by'
        and data_type = 'uuid'
        and is_nullable = 'YES'
    ),
    'completion actor uses nullable uuid so history survives user deletion'
  )
);

insert into restaurant_activation_results values (
  5,
  col_default_is(
    'public',
    'restaurant_activation_progress',
    'completed_by',
    'auth.uid()',
    'completion actor defaults to the authenticated user'
  )
);

insert into restaurant_activation_results values (
  6,
  ok(
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.restaurant_activation_progress'::regclass
        and contype = 'p'
        and pg_get_constraintdef(oid) = 'PRIMARY KEY (restaurant_id, module_key)'
    ),
    'restaurant and module form the primary key'
  )
);

insert into restaurant_activation_results values (
  7,
  ok(
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.restaurant_activation_progress'::regclass
        and conname = 'restaurant_activation_progress_restaurant_id_fkey'
        and confrelid = 'public.restaurants'::regclass
        and confdeltype = 'c'
    ),
    'restaurant foreign key cascades on delete'
  )
);

insert into restaurant_activation_results values (
  8,
  ok(
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.restaurant_activation_progress'::regclass
        and conname = 'restaurant_activation_progress_completed_by_fkey'
        and confrelid = 'auth.users'::regclass
        and confdeltype = 'n'
    ),
    'completion actor references auth users without blocking user deletion'
  )
);

insert into restaurant_activation_results values (
  9,
  ok(
    exists (
      select 1
      from pg_class
      where oid = 'public.restaurant_activation_progress'::regclass
        and relrowsecurity
    ),
    'restaurant activation progress has row level security enabled'
  )
);

insert into restaurant_activation_results values (
  10,
  is(
    (
      select count(*)::integer
      from pg_policies
      where schemaname = 'public'
        and tablename = 'restaurant_activation_progress'
    ),
    2,
    'only select and insert client policies exist'
  )
);

insert into restaurant_activation_results values (
  11,
  ok(
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'restaurant_activation_progress'
        and policyname = 'restaurant_members_read_activation_progress'
        and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and qual ilike '%is_restaurant_member%'
    ),
    'active restaurant members can read activation progress'
  )
);

insert into restaurant_activation_results values (
  12,
  ok(
    exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'restaurant_activation_progress'
        and policyname = 'restaurant_members_insert_activation_progress'
        and cmd = 'INSERT'
        and roles = array['authenticated']::name[]
        and with_check ilike '%is_restaurant_member%'
        and with_check ilike '%auth.uid%'
    ),
    'activation inserts require membership and the real authenticated actor'
  )
);

insert into restaurant_activation_results values (
  13,
  ok(
    has_table_privilege('authenticated', 'public.restaurant_activation_progress', 'select')
      and has_table_privilege('authenticated', 'public.restaurant_activation_progress', 'insert')
      and not has_table_privilege('authenticated', 'public.restaurant_activation_progress', 'update')
      and not has_table_privilege('authenticated', 'public.restaurant_activation_progress', 'delete'),
    'authenticated receives only select and insert grants'
  )
);

insert into restaurant_activation_results values (
  14,
  ok(
    not has_table_privilege('anon', 'public.restaurant_activation_progress', 'select')
      and not has_table_privilege('anon', 'public.restaurant_activation_progress', 'insert')
      and not exists (
        select 1
        from pg_class as relation
        cross join lateral aclexplode(
          coalesce(relation.relacl, acldefault('r', relation.relowner))
        ) as privilege
        where relation.oid = 'public.restaurant_activation_progress'::regclass
          and privilege.grantee = 0
          and privilege.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      ),
    'anonymous and public roles have no activation progress grants'
  )
);

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from restaurant_activation_context where fixture = 'member_a'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from restaurant_activation_context
    where fixture = 'member_a'
  ),
  true
);
set local role authenticated;

insert into restaurant_activation_finalization (restaurant_id)
select id
from public.finalize_onboarding(
  (select restaurant_id from restaurant_activation_context where fixture = 'member_a')
);

reset role;

insert into restaurant_activation_results
select 15, is(
  (select count(*)::integer from public.restaurant_activation_progress),
  0,
  'finalizing onboarding does not create activation progress automatically'
);

insert into public.restaurant_activation_progress (
  restaurant_id,
  module_key,
  completed_by
)
select restaurant_id, 'overview', user_id
from restaurant_activation_context
where fixture = 'member_b';

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from restaurant_activation_context where fixture = 'member_a'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from restaurant_activation_context
    where fixture = 'member_a'
  ),
  true
);
set local role authenticated;

insert into public.restaurant_activation_progress (restaurant_id, module_key)
select restaurant_id, module_key
from restaurant_activation_context
cross join unnest(array['cashier', 'menu', 'kitchen', 'settings']) as module_key
where fixture = 'member_a';

insert into restaurant_activation_results
select 16, throws_ok(
  format(
    'insert into public.restaurant_activation_progress (restaurant_id, module_key, completed_by) values (%L::uuid, %L, %L::uuid)',
    own.restaurant_id,
    'overview',
    other_user.user_id
  ),
  '42501'::char(5),
  null,
  'members cannot spoof the completion actor'
)
from restaurant_activation_context as own
cross join restaurant_activation_context as other_user
where own.fixture = 'member_a'
  and other_user.fixture = 'member_b';

insert into public.restaurant_activation_progress (restaurant_id, module_key)
select restaurant_id, 'overview'
from restaurant_activation_context
where fixture = 'member_a';

insert into restaurant_activation_results
select 17, is(
  (
    select array_agg(module_key order by module_key)
    from public.restaurant_activation_progress
    where restaurant_id = context.restaurant_id
  ),
  array['cashier', 'kitchen', 'menu', 'overview', 'settings']::text[],
  'all and only supported activation modules can be recorded'
)
from restaurant_activation_context as context
where context.fixture = 'member_a';

insert into restaurant_activation_results
select 18, ok(
  progress.completed_by = context.user_id
    and progress.completed_at is not null,
  'the database records the authenticated actor and completion time'
)
from restaurant_activation_context as context
join public.restaurant_activation_progress as progress
  on progress.restaurant_id = context.restaurant_id
 and progress.module_key = 'cashier'
where context.fixture = 'member_a';

insert into restaurant_activation_results
select 19, throws_ok(
  format(
    'insert into public.restaurant_activation_progress (restaurant_id, module_key) values (%L::uuid, %L)',
    context.restaurant_id,
    'cashier'
  ),
  '42501'::char(5),
  null,
  'members cannot insert progress for another restaurant'
)
from restaurant_activation_context as context
where context.fixture = 'member_b';

insert into restaurant_activation_results
select 20, is(
  (select count(*)::integer from public.restaurant_activation_progress),
  5,
  'members can read only their own restaurant progress'
);

insert into restaurant_activation_results
select 21, throws_ok(
  format(
    'insert into public.restaurant_activation_progress (restaurant_id, module_key) values (%L::uuid, %L)',
    context.restaurant_id,
    'cashier'
  ),
  '23505'::char(5),
  null,
  'duplicate completion returns the conflict used for idempotent client handling'
)
from restaurant_activation_context as context
where context.fixture = 'member_a';

insert into restaurant_activation_results
select 22, throws_ok(
  format(
    'insert into public.restaurant_activation_progress (restaurant_id, module_key) values (%L::uuid, %L)',
    context.restaurant_id,
    'unsupported'
  ),
  '23514'::char(5),
  null,
  'unsupported activation modules are rejected'
)
from restaurant_activation_context as context
where context.fixture = 'member_a';

insert into restaurant_activation_results
select 23, throws_ok(
  format(
    'update public.restaurant_activation_progress set completed_at = now() where restaurant_id = %L::uuid',
    context.restaurant_id
  ),
  '42501'::char(5),
  null,
  'clients cannot update activation progress'
)
from restaurant_activation_context as context
where context.fixture = 'member_a';

insert into restaurant_activation_results
select 24, throws_ok(
  format(
    'delete from public.restaurant_activation_progress where restaurant_id = %L::uuid',
    context.restaurant_id
  ),
  '42501'::char(5),
  null,
  'clients cannot delete activation progress'
)
from restaurant_activation_context as context
where context.fixture = 'member_a';

reset role;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from restaurant_activation_context where fixture = 'member_b'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from restaurant_activation_context
    where fixture = 'member_b'
  ),
  true
);
set local role authenticated;

insert into restaurant_activation_results
select 25, is(
  (select count(*)::integer from public.restaurant_activation_progress),
  1,
  'restaurant B reads only restaurant B activation progress'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from restaurant_activation_context where fixture = 'inactive_a'),
  true
);
select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object('sub', user_id, 'role', 'authenticated')::text
    from restaurant_activation_context
    where fixture = 'inactive_a'
  ),
  true
);
set local role authenticated;

insert into restaurant_activation_results
select 26, is(
  (select count(*)::integer from public.restaurant_activation_progress),
  0,
  'disabled members cannot read restaurant activation progress'
);

insert into restaurant_activation_results
select 27, throws_ok(
  format(
    'insert into public.restaurant_activation_progress (restaurant_id, module_key) values (%L::uuid, %L)',
    context.restaurant_id,
    'cashier'
  ),
  '42501'::char(5),
  null,
  'disabled members cannot insert restaurant activation progress'
)
from restaurant_activation_context as context
where context.fixture = 'inactive_a';

reset role;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

insert into restaurant_activation_results
select 28, throws_ok(
  'select count(*) from public.restaurant_activation_progress',
  '42501'::char(5),
  null,
  'anonymous users cannot read restaurant activation progress'
);

reset role;

insert into restaurant_activation_results
select 29, finish();

select sequence, result
from restaurant_activation_results
order by sequence;

rollback;
