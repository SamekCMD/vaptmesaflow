-- Read-only ACL verification for preview.vapt. Confirm the Neon branch ID in
-- the console before running: br-rough-dew-b6ydeygb. Never run on production.
do $verify$
declare
  api_role oid;
  missing_privileges text;
  allowed_table_privileges text[];
  allowed_functions oid[];
begin
  if current_database() <> 'vapt' then
    raise exception 'Expected database vapt, got %', current_database();
  end if;

  select oid into api_role from pg_catalog.pg_roles where rolname = 'vapt_api_preview';
  if api_role is null then
    raise exception 'Preview API role is absent';
  end if;

  if exists (
    select 1 from pg_catalog.pg_roles
    where oid = api_role and (not rolcanlogin or rolsuper or rolcreatedb
      or rolcreaterole or rolreplication or rolbypassrls)
  ) then
    raise exception 'Preview API role has unsafe role attributes';
  end if;

  if exists (
    select 1 from pg_catalog.pg_auth_members
    where member = api_role
  ) then
    raise exception 'Preview API role inherits another role';
  end if;

  if not pg_catalog.has_database_privilege(api_role, 'vapt', 'CONNECT')
    or pg_catalog.has_database_privilege(api_role, 'vapt', 'CREATE')
    or not pg_catalog.has_schema_privilege(api_role, 'public', 'USAGE')
    or pg_catalog.has_schema_privilege(api_role, 'public', 'CREATE')
    or not pg_catalog.has_schema_privilege(api_role, 'better_auth', 'USAGE')
    or pg_catalog.has_schema_privilege(api_role, 'better_auth', 'CREATE')
  then
    raise exception 'Preview API database/schema ACL mismatch';
  end if;

  if exists (
    select 1 from pg_catalog.pg_database where datname = 'vapt' and datdba = api_role
    union all
    select 1 from pg_catalog.pg_namespace
      where nspname in ('public', 'better_auth') and nspowner = api_role
    union all
    select 1 from pg_catalog.pg_class
      where relnamespace in ('public'::regnamespace, 'better_auth'::regnamespace)
        and relowner = api_role
    union all
    select 1 from pg_catalog.pg_proc
      where pronamespace in ('public'::regnamespace, 'better_auth'::regnamespace)
        and proowner = api_role
  ) then
    raise exception 'Preview API role owns a database or schema object';
  end if;

  select pg_catalog.string_agg(object_name || ':' || privilege, ', ' order by object_name, privilege)
      filter (where not pg_catalog.has_table_privilege(api_role, object_name, privilege)),
    pg_catalog.array_agg(object_name || ':' || privilege)
    into missing_privileges, allowed_table_privileges
  from (values
    ('public.restaurants', 'SELECT'), ('public.restaurants', 'INSERT'), ('public.restaurants', 'UPDATE'),
    ('public.menu_items', 'SELECT'), ('public.menu_items', 'INSERT'), ('public.menu_items', 'UPDATE'), ('public.menu_items', 'DELETE'),
    ('public.menu_item_variations', 'SELECT'), ('public.menu_item_variations', 'INSERT'), ('public.menu_item_variations', 'DELETE'),
    ('public.table_sessions', 'SELECT'), ('public.table_sessions', 'UPDATE'),
    ('public.orders', 'SELECT'), ('public.orders', 'UPDATE'),
    ('public.order_items', 'SELECT'),
    ('public.order_feedback', 'SELECT'), ('public.order_feedback', 'INSERT'), ('public.order_feedback', 'UPDATE'),
    ('public.push_subscriptions', 'SELECT'), ('public.push_subscriptions', 'INSERT'), ('public.push_subscriptions', 'UPDATE'),
    ('public.billing_provider_events', 'SELECT'), ('public.billing_provider_events', 'INSERT'), ('public.billing_provider_events', 'UPDATE'),
    ('public.payment_provider_accounts', 'SELECT'), ('public.payment_provider_accounts', 'INSERT'), ('public.payment_provider_accounts', 'UPDATE'),
    ('public.payment_transactions', 'SELECT'), ('public.payment_transactions', 'INSERT'),
    ('public.payment_webhook_events', 'SELECT'), ('public.payment_webhook_events', 'INSERT'), ('public.payment_webhook_events', 'UPDATE'),
    ('public.payment_oauth_states', 'SELECT'), ('public.payment_oauth_states', 'INSERT'), ('public.payment_oauth_states', 'UPDATE'),
    ('public.billing_email_outbox', 'INSERT'),
    ('better_auth.user', 'SELECT'), ('better_auth.user', 'INSERT'), ('better_auth.user', 'UPDATE'), ('better_auth.user', 'DELETE'),
    ('better_auth.session', 'SELECT'), ('better_auth.session', 'INSERT'), ('better_auth.session', 'UPDATE'), ('better_auth.session', 'DELETE'),
    ('better_auth.account', 'SELECT'), ('better_auth.account', 'INSERT'), ('better_auth.account', 'UPDATE'), ('better_auth.account', 'DELETE'),
    ('better_auth.verification', 'SELECT'), ('better_auth.verification', 'INSERT'), ('better_auth.verification', 'UPDATE'), ('better_auth.verification', 'DELETE')
  ) as required(object_name, privilege);
  if missing_privileges is not null then
    raise exception 'Missing API table privileges: %', missing_privileges;
  end if;

  select pg_catalog.string_agg(function_name, ', ' order by function_name)
      filter (where not pg_catalog.has_function_privilege(api_role, function_name, 'EXECUTE')),
    pg_catalog.array_agg(function_name::regprocedure::oid)
    into missing_privileges, allowed_functions
  from (values
    ('public.create_public_order_v3(text,text,integer,jsonb,jsonb,text,text,text)'),
    ('public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])'),
    ('public.claim_payment_effects(text,integer,timestamptz,timestamptz)'),
    ('public.complete_payment_effect(uuid,text,timestamptz)'),
    ('public.fail_payment_effect(uuid,text,text,integer,timestamptz,text)'),
    ('public.release_paid_order_to_production(uuid,uuid)'),
    ('public.count_pending_payment_effects()')
  ) as required(function_name);
  if missing_privileges is not null then
    raise exception 'Missing API function privileges: %', missing_privileges;
  end if;

  if exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as checked(privilege)
    where namespace.nspname in ('public', 'better_auth')
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
      and not (namespace.nspname || '.' || relation.relname || ':' || checked.privilege)
        = any(allowed_table_privileges)
      and (pg_catalog.has_table_privilege(api_role, relation.oid, checked.privilege)
        or case when checked.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
          then pg_catalog.has_any_column_privilege(api_role, relation.oid, checked.privilege)
          else false end)
  ) or exists (
    select 1 from pg_catalog.pg_proc
    where pronamespace in ('public'::regnamespace, 'better_auth'::regnamespace)
      and not oid = any(allowed_functions)
      and pg_catalog.has_function_privilege(api_role, oid, 'EXECUTE')
      -- Preserve only the reviewed pgcrypto extension baseline.
      -- Application routines and trigger functions use the exact list above.
      and not exists (
        select 1 from pg_catalog.pg_depend as dependency
        join pg_catalog.pg_extension as extension on extension.oid = dependency.refobjid
        where dependency.classid = 'pg_proc'::regclass and dependency.objid = pg_proc.oid
          and dependency.refclassid = 'pg_extension'::regclass
          and dependency.deptype = 'e' and extension.extname = 'pgcrypto'
      )
  )
  then
    raise exception 'Preview API role has unintended privileges';
  end if;
end
$verify$;
