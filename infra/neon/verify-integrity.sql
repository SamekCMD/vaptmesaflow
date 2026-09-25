-- Executar depois do baseline completo no database `vapt`.
-- Somente leitura: valida isolamento, colunas críticas, segurança e objetos auxiliares.

do $verify$
declare
  expected_tables constant text[] := array[
    'restaurants',
    'menu_items',
    'menu_item_variations',
    'table_sessions',
    'orders',
    'order_items',
    'order_feedback',
    'push_subscriptions',
    'payment_provider_events',
    'billing_provider_events',
    'payment_provider_accounts',
    'payment_transactions',
    'payment_webhook_events',
    'payment_oauth_states',
    'payment_effect_outbox'
  ];
  expected_routines constant text[] := array[
    'public.set_order_display_id()',
    'public.update_updated_at_column()',
    'public.get_public_restaurant_by_slug(text)',
    'public.create_public_order_v2(text,text,integer,jsonb,jsonb,text,text,text)',
    'public.create_public_order_v3(text,text,integer,jsonb,jsonb,text,text,text)',
    'public.apply_payment_transition(uuid,integer,text,text,text,timestamptz,text[])',
    'public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])',
    'public.claim_payment_effects(text,integer,timestamptz,timestamptz)',
    'public.complete_payment_effect(uuid,text,timestamptz)',
    'public.fail_payment_effect(uuid,text,text,integer,timestamptz,text)',
    'public.release_paid_order_to_production(uuid,uuid)',
    'public.count_pending_payment_effects()'
  ];
  expected_constraints constant text[] := array[
    'orders_id_restaurant_id_key',
    'orders_payment_transaction_tenant_fkey',
    'order_feedback_rating_check',
    'payment_transactions_order_tenant_fkey',
    'payment_transactions_provider_account_tenant_fkey',
    'payment_webhook_events_transaction_tenant_fkey',
    'payment_effect_outbox_transaction_tenant_fkey'
  ];
  expected_indexes constant text[] := array[
    'orders_restaurant_idempotency_key_idx',
    'orders_public_access_token_idx',
    'payment_transactions_provider_external_payment_id_uidx',
    'payment_transactions_one_active_manual_per_order_idx',
    'payment_webhook_events_pending_idx',
    'payment_effect_outbox_available_idx',
    'payment_effect_outbox_expired_lease_idx'
  ];
  missing_columns text[];
  unexpected_tables text[];
  unsafe_routines text[];
  public_routines text[];
  missing_constraints text[];
  missing_indexes text[];
begin
  if current_database() <> 'vapt' then
    raise exception 'wrong database: expected vapt, got %', current_database();
  end if;

  select array_agg(format('%I.%I', expected.table_name, expected.column_name)
                   order by expected.table_name, expected.column_name)
    into missing_columns
    from (values
      ('restaurants', 'owner_id', 'uuid', 'NO'),
      ('restaurants', 'cnpj', 'text', 'YES'),
      ('restaurants', 'stripe_customer_id', 'text', 'YES'),
      ('restaurants', 'stripe_subscription_id', 'text', 'YES'),
      ('restaurants', 'asaas_api_key', 'text', 'YES'),
      ('restaurants', 'asaas_webhook_token', 'text', 'YES'),
      ('restaurants', 'local_enabled', 'bool', 'NO'),
      ('restaurants', 'delivery_enabled', 'bool', 'NO'),
      ('restaurants', 'onboarding_completed', 'bool', 'NO'),
      ('table_sessions', 'opened_at', 'timestamptz', 'NO'),
      ('orders', 'display_id', 'int8', 'YES'),
      ('orders', 'public_access_token_hash', 'text', 'YES'),
      ('orders', 'creation_idempotency_key', 'text', 'YES'),
      ('orders', 'creation_request_fingerprint', 'text', 'YES'),
      ('orders', 'payment_transaction_id', 'uuid', 'YES'),
      ('order_feedback', 'order_id', 'uuid', 'NO'),
      ('order_feedback', 'rating', 'int4', 'NO'),
      ('payment_provider_accounts', 'restaurant_id', 'uuid', 'NO'),
      ('payment_transactions', 'restaurant_id', 'uuid', 'NO'),
      ('payment_transactions', 'order_id', 'uuid', 'NO'),
      ('payment_webhook_events', 'restaurant_id', 'uuid', 'YES'),
      ('payment_effect_outbox', 'restaurant_id', 'uuid', 'NO')
    ) as expected(table_name, column_name, udt_name, is_nullable)
   where not exists (
     select 1
       from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = expected.table_name
        and actual.column_name = expected.column_name
        and actual.udt_name = expected.udt_name
        and actual.is_nullable = expected.is_nullable
   );

  if coalesce(cardinality(missing_columns), 0) > 0 then
    raise exception 'critical columns missing or incompatible: %',
      array_to_string(missing_columns, ', ');
  end if;

  select array_agg(table_name order by table_name)
    into unexpected_tables
    from information_schema.tables
   where table_schema = 'public'
     and table_type = 'BASE TABLE'
     and table_name <> all(expected_tables);

  if coalesce(cardinality(unexpected_tables), 0) > 0 then
    raise exception 'unexpected public tables: %', array_to_string(unexpected_tables, ', ');
  end if;

  if exists (
    select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = any(expected_tables)
       and (relation.relrowsecurity or relation.relforcerowsecurity)
  ) then
    raise exception 'RLS must stay disabled until the API authorization boundary is installed';
  end if;

  if exists (
    select 1
      from pg_policy as policy
      join pg_class as relation on relation.oid = policy.polrelid
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname = any(expected_tables)
  ) then
    raise exception 'Supabase-era policies must not be copied to the Neon business baseline';
  end if;

  if exists (
    select 1
      from pg_namespace as namespace
      cross join lateral aclexplode(
        coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
      ) as privilege
     where namespace.nspname = 'public'
       and privilege.grantee = 0
       and privilege.privilege_type = 'CREATE'
  ) then
    raise exception 'PUBLIC must not have CREATE privilege on schema public';
  end if;

  if exists (
    select 1 from pg_namespace where nspname in ('auth', 'storage', 'supabase_functions')
  ) or exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase-specific schemas or publications were found';
  end if;

  if not exists (
    select 1 from pg_extension where extname = 'pgcrypto'
  ) then
    raise exception 'required extension pgcrypto is missing';
  end if;

  select array_agg(expected.signature order by expected.signature)
    into unsafe_routines
    from unnest(expected_routines) as expected(signature)
    join pg_proc as routine on routine.oid = to_regprocedure(expected.signature)
   where (
        expected.signature not in (
          'public.set_order_display_id()',
          'public.update_updated_at_column()'
        )
        and not routine.prosecdef
      )
      or not exists (
        select 1
          from unnest(coalesce(routine.proconfig, '{}'::text[])) as setting(value)
         where setting.value like 'search_path=pg_catalog, public%'
      );

  if coalesce(cardinality(unsafe_routines), 0) > 0 then
    raise exception 'routines with an unsafe execution mode or search_path: %',
      array_to_string(unsafe_routines, ', ');
  end if;

  select array_agg(expected.signature order by expected.signature)
    into public_routines
    from unnest(expected_routines) as expected(signature)
    join pg_proc as routine on routine.oid = to_regprocedure(expected.signature)
   where exists (
     select 1
       from aclexplode(coalesce(routine.proacl, acldefault('f', routine.proowner))) as privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
   );

  if coalesce(cardinality(public_routines), 0) > 0 then
    raise exception 'PUBLIC can execute protected routines: %',
      array_to_string(public_routines, ', ');
  end if;

  if pg_get_function_result(to_regprocedure('public.get_public_restaurant_by_slug(text)'))
     ~* '(owner_id|cnpj|stripe_|asaas_|billing_last_error)' then
    raise exception 'public restaurant lookup exposes a sensitive column';
  end if;

  select array_agg(expected.constraint_name order by expected.constraint_name)
    into missing_constraints
    from unnest(expected_constraints) as expected(constraint_name)
   where not exists (
     select 1
       from pg_constraint
      where conname = expected.constraint_name
   );

  if coalesce(cardinality(missing_constraints), 0) > 0 then
    raise exception 'critical constraints missing: %', array_to_string(missing_constraints, ', ');
  end if;

  select array_agg(expected.index_name order by expected.index_name)
    into missing_indexes
    from unnest(expected_indexes) as expected(index_name)
   where to_regclass(format('public.%I', expected.index_name)) is null;

  if coalesce(cardinality(missing_indexes), 0) > 0 then
    raise exception 'critical indexes missing: %', array_to_string(missing_indexes, ', ');
  end if;
end
$verify$;
