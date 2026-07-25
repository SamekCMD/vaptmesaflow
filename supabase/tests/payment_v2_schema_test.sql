begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(48);

select has_table('public', 'payment_provider_accounts', 'provider accounts table exists');
select has_table('public', 'payment_transactions', 'payment transactions table exists');
select has_table('public', 'payment_webhook_events', 'payment webhook events table exists');
select has_table('public', 'payment_oauth_states', 'payment OAuth states table exists');
select has_table('public', 'payment_effect_outbox', 'payment effect outbox table exists');

select has_column('public', 'orders', 'payment_transaction_id', 'orders summarize the current transaction');
select has_column('public', 'orders', 'payment_method', 'orders summarize the payment method');
select has_column('public', 'orders', 'payment_processing_mode', 'orders summarize the processing mode');

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (payment_transaction_id, restaurant_id) REFERENCES payment_transactions(id, restaurant_id)%'
  ),
  'order summaries enforce the transaction tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_provider_accounts'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)%'
  ),
  'provider accounts belong to a restaurant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (order_id, restaurant_id) REFERENCES orders(id, restaurant_id)%'
  ),
  'transactions enforce the order tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (provider_account_id, restaurant_id) REFERENCES payment_provider_accounts(id, restaurant_id)%'
  ),
  'transactions enforce the provider account tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_webhook_events'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (provider_account_id, restaurant_id) REFERENCES payment_provider_accounts(id, restaurant_id)%'
  ),
  'webhook events enforce the provider account tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_webhook_events'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (payment_transaction_id, restaurant_id) REFERENCES payment_transactions(id, restaurant_id)%'
  ),
  'webhook events enforce the transaction tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_oauth_states'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)%'
  ),
  'OAuth states belong to a restaurant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_effect_outbox'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%FOREIGN KEY (payment_transaction_id, restaurant_id) REFERENCES payment_transactions(id, restaurant_id)%'
  ),
  'outbox effects enforce the transaction tenant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%amount > 0%'
  ),
  'transaction amount must be positive'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%currency ~%[A-Z]{3}%'
  ),
  'transaction currency uses an ISO-like code'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_transactions'
      and indexdef like '%UNIQUE%provider, external_payment_id%'
  ),
  'external payment IDs are unique per provider'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (restaurant_id, idempotency_key)%'
  ),
  'idempotency keys are unique per restaurant'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_webhook_events'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (provider, external_event_id)%'
  ),
  'provider webhook event IDs are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_effect_outbox'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (payment_transaction_id, effect_type)%'
  ),
  'payment effects are unique per transaction'
);

select ok((select relrowsecurity from pg_class where oid = 'public.payment_provider_accounts'::regclass), 'provider accounts have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_transactions'::regclass), 'payment transactions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_webhook_events'::regclass), 'payment webhook events have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_oauth_states'::regclass), 'payment OAuth states have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_effect_outbox'::regclass), 'payment effect outbox has RLS');

select ok(not has_table_privilege('anon', 'public.payment_provider_accounts', 'select'), 'anon cannot select provider accounts');
select ok(not has_table_privilege('authenticated', 'public.payment_provider_accounts', 'select'), 'authenticated cannot select provider accounts');
select ok(not has_table_privilege('anon', 'public.payment_transactions', 'select'), 'anon cannot select payment transactions');
select ok(not has_table_privilege('authenticated', 'public.payment_transactions', 'select'), 'authenticated cannot select payment transactions');
select ok(not has_table_privilege('anon', 'public.payment_webhook_events', 'select'), 'anon cannot select payment webhook events');
select ok(not has_table_privilege('authenticated', 'public.payment_webhook_events', 'select'), 'authenticated cannot select payment webhook events');
select ok(not has_table_privilege('anon', 'public.payment_oauth_states', 'select'), 'anon cannot select OAuth states');
select ok(not has_table_privilege('authenticated', 'public.payment_oauth_states', 'select'), 'authenticated cannot select OAuth states');
select ok(not has_table_privilege('anon', 'public.payment_effect_outbox', 'select'), 'anon cannot select payment effects');
select ok(not has_table_privilege('authenticated', 'public.payment_effect_outbox', 'select'), 'authenticated cannot select payment effects');

select ok(not has_column_privilege('anon', 'public.payment_provider_accounts', 'access_token_encrypted', 'select'), 'anon cannot read encrypted access tokens');
select ok(not has_column_privilege('authenticated', 'public.payment_provider_accounts', 'access_token_encrypted', 'select'), 'authenticated cannot read encrypted access tokens');
select ok(not has_column_privilege('anon', 'public.payment_provider_accounts', 'refresh_token_encrypted', 'select'), 'anon cannot read encrypted refresh tokens');
select ok(not has_column_privilege('authenticated', 'public.payment_provider_accounts', 'refresh_token_encrypted', 'select'), 'authenticated cannot read encrypted refresh tokens');
select ok(not has_column_privilege('anon', 'public.payment_oauth_states', 'code_verifier_encrypted', 'select'), 'anon cannot read encrypted OAuth verifiers');
select ok(not has_column_privilege('authenticated', 'public.payment_oauth_states', 'code_verifier_encrypted', 'select'), 'authenticated cannot read encrypted OAuth verifiers');

select ok(not has_function_privilege('anon', 'public.apply_payment_transition(uuid,integer,text,text,text,timestamp with time zone,text[])', 'execute'), 'anon cannot apply payment transitions');
select ok(not has_function_privilege('authenticated', 'public.apply_payment_transition(uuid,integer,text,text,text,timestamp with time zone,text[])', 'execute'), 'authenticated cannot apply payment transitions');
select ok(has_function_privilege('service_role', 'public.apply_payment_transition(uuid,integer,text,text,text,timestamp with time zone,text[])', 'execute'), 'service role can apply payment transitions');

select has_column('public', 'orders', 'payment_status', 'legacy payment status remains available');
select has_column('public', 'orders', 'payment_confirmed_at', 'legacy payment confirmation timestamp remains available');

select * from finish();

rollback;
