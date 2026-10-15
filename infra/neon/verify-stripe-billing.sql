-- Read-only Phase 7 gate. Run before 005 for RED evidence, then after it for GREEN.
do $verify$
declare
  missing_columns text[];
  missing_constraints text[];
  missing_indexes text[];
begin
  if current_database() <> 'vapt' then
    raise exception 'wrong database: expected vapt, got %', current_database();
  end if;

  if to_regclass('public.billing_email_outbox') is null then
    raise exception 'Stripe billing migration missing: billing_email_outbox';
  end if;

  select array_agg(format('%I.%I', expected.table_name, expected.column_name))
    into missing_columns
    from (values
      ('restaurants', 'stripe_subscription_item_id', 'text', 'YES'),
      ('restaurants', 'stripe_current_period_end', 'timestamptz', 'YES'),
      ('restaurants', 'stripe_cancel_at_period_end', 'bool', 'NO'),
      ('restaurants', 'stripe_state_updated_at', 'timestamptz', 'YES'),
      ('restaurants', 'stripe_checkout_session_id', 'text', 'YES'),
      ('restaurants', 'stripe_checkout_plan_type', 'text', 'YES'),
      ('restaurants', 'stripe_checkout_expires_at', 'timestamptz', 'YES'),
      ('billing_provider_events', 'processing_status', 'text', 'NO'),
      ('billing_provider_events', 'attempt_count', 'int4', 'NO'),
      ('billing_provider_events', 'processing_started_at', 'timestamptz', 'YES'),
      ('billing_provider_events', 'last_error', 'text', 'YES'),
      ('billing_provider_events', 'processed_at', 'timestamptz', 'YES'),
      ('billing_email_outbox', 'id', 'uuid', 'NO'),
      ('billing_email_outbox', 'restaurant_id', 'uuid', 'NO'),
      ('billing_email_outbox', 'provider_event_id', 'text', 'NO'),
      ('billing_email_outbox', 'email_kind', 'text', 'NO'),
      ('billing_email_outbox', 'billing_resource_id', 'text', 'NO'),
      ('billing_email_outbox', 'payload', 'jsonb', 'NO'),
      ('billing_email_outbox', 'delivery_status', 'text', 'NO'),
      ('billing_email_outbox', 'attempt_count', 'int4', 'NO'),
      ('billing_email_outbox', 'processing_started_at', 'timestamptz', 'YES'),
      ('billing_email_outbox', 'next_attempt_at', 'timestamptz', 'NO'),
      ('billing_email_outbox', 'last_error', 'text', 'YES'),
      ('billing_email_outbox', 'sent_at', 'timestamptz', 'YES'),
      ('billing_email_outbox', 'created_at', 'timestamptz', 'NO'),
      ('billing_email_outbox', 'updated_at', 'timestamptz', 'NO')
    ) as expected(table_name, column_name, udt_name, is_nullable)
   where not exists (
     select 1 from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = expected.table_name
        and actual.column_name = expected.column_name
        and actual.udt_name = expected.udt_name
        and actual.is_nullable = expected.is_nullable
   );
  if coalesce(cardinality(missing_columns), 0) > 0 then
    raise exception 'Stripe billing columns missing or incompatible: %', missing_columns;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'billing_provider_events'
       and column_name = 'processed_at' and column_default is not null
  ) then
    raise exception 'billing_provider_events.processed_at must have no default';
  end if;

  select array_agg(expected.constraint_name) into missing_constraints
    from (values
      ('restaurants', 'restaurants_plan_status_check', 'c'),
      ('restaurants', 'restaurants_stripe_checkout_check', 'c'),
      ('billing_provider_events', 'billing_provider_events_processing_status_check', 'c'),
      ('billing_provider_events', 'billing_provider_events_attempt_count_check', 'c'),
      ('billing_email_outbox', 'billing_email_outbox_restaurant_fkey', 'f'),
      ('billing_email_outbox', 'billing_email_outbox_event_kind_key', 'u'),
      ('billing_email_outbox', 'billing_email_outbox_resource_kind_key', 'u'),
      ('billing_email_outbox', 'billing_email_outbox_kind_check', 'c'),
      ('billing_email_outbox', 'billing_email_outbox_delivery_status_check', 'c'),
      ('billing_email_outbox', 'billing_email_outbox_attempt_count_check', 'c'),
      ('billing_email_outbox', 'billing_email_outbox_payload_check', 'c')
    ) as expected(table_name, constraint_name, kind)
   where not exists (
     select 1 from pg_constraint as actual
      where actual.conname = expected.constraint_name
        and actual.conrelid = to_regclass('public.' || expected.table_name)
        and actual.contype::text = expected.kind and actual.convalidated
   );
  if coalesce(cardinality(missing_constraints), 0) > 0 then
    raise exception 'Stripe billing constraints missing: %', missing_constraints;
  end if;

  select array_agg(expected.index_name) into missing_indexes
    from (values
      ('restaurants_stripe_customer_uidx', 'restaurants', 'stripe_customer_id'),
      ('restaurants_stripe_subscription_uidx', 'restaurants', 'stripe_subscription_id')
    ) as expected(index_name, table_name, column_name)
   where not exists (
     select 1 from pg_index as idx
      where idx.indexrelid = to_regclass('public.' || expected.index_name)
        and idx.indrelid = to_regclass('public.' || expected.table_name)
        and idx.indisunique and idx.indisvalid and idx.indnkeyatts = 1
        and pg_get_indexdef(idx.indexrelid, 1, true) = expected.column_name
        and pg_get_expr(idx.indpred, idx.indrelid) =
          '(' || expected.column_name || ' IS NOT NULL)'
   );
  if coalesce(cardinality(missing_indexes), 0) > 0 then
    raise exception 'Stripe billing unique partial indexes missing: %', missing_indexes;
  end if;
  if to_regclass('public.billing_provider_events_retry_idx') is null
    or to_regclass('public.billing_email_outbox_delivery_idx') is null then
    raise exception 'Stripe billing retry/delivery indexes missing';
  end if;

  if exists (
    select 1 from pg_class as relation
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) as privilege
    where relation.oid = 'public.billing_email_outbox'::regclass
      and privilege.grantee = 0
  ) or exists (
    select 1 from pg_attribute as column_info
    cross join lateral aclexplode(column_info.attacl) as privilege
    where column_info.attrelid = 'public.billing_email_outbox'::regclass
      and privilege.grantee = 0
  ) then
    raise exception 'PUBLIC must have no table or column access to billing_email_outbox';
  end if;

  if pg_get_function_result(to_regprocedure('public.get_public_restaurant_by_slug(text)'))
     ~* '(stripe_|billing_last_error)' then
    raise exception 'public restaurant lookup exposes Stripe billing fields';
  end if;
end
$verify$;
