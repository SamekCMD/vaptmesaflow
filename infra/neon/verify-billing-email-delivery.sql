-- Read-only Phase 8 gate. It must fail before migration 006 and pass after it.
do $verify$
declare
  missing_columns text[];
  actual_index text;
  actual_constraint text;
begin
  if current_database() <> 'vapt' then
    raise exception 'wrong database: expected vapt, got %', current_database();
  end if;

  if to_regclass('public.billing_email_outbox') is null then
    raise exception 'billing_email_outbox is missing';
  end if;

  select array_agg(expected.column_name)
    into missing_columns
    from (values
      ('first_send_attempt_at', 'timestamptz'),
      ('recipient_email', 'text'),
      ('template_alias', 'text'),
      ('template_variables', 'jsonb'),
      ('resend_email_id', 'text')
    ) as expected(column_name, udt_name)
   where not exists (
     select 1 from information_schema.columns as actual
      where actual.table_schema = 'public'
        and actual.table_name = 'billing_email_outbox'
        and actual.column_name = expected.column_name
        and actual.udt_name = expected.udt_name
        and actual.is_nullable = 'YES'
        and actual.column_default is null
   );
  if coalesce(cardinality(missing_columns), 0) > 0 then
    raise exception 'billing email delivery columns missing or incompatible: %', missing_columns;
  end if;

  select pg_get_constraintdef(oid) into actual_constraint
    from pg_constraint
   where conrelid = 'public.billing_email_outbox'::regclass
     and conname = 'billing_email_outbox_template_variables_check'
     and contype = 'c' and convalidated;
  if actual_constraint is null
    or actual_constraint not like '%template_variables IS NULL%'
    or actual_constraint not like '%jsonb_typeof(template_variables)%object%' then
    raise exception 'template_variables object-or-null constraint missing';
  end if;

  select pg_get_indexdef(indexrelid) into actual_index
    from pg_index
   where indexrelid = to_regclass('public.billing_email_outbox_processing_lease_idx')
     and indrelid = 'public.billing_email_outbox'::regclass
     and indisvalid and indisready
     and pg_get_expr(indpred, indrelid) = '(delivery_status = ''processing''::text)';
  if actual_index is null
    or actual_index not like '%(processing_started_at)%' then
    raise exception 'processing lease partial index missing';
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
end
$verify$;
