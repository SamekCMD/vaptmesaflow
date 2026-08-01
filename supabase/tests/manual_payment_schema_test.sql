begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(3);

select has_column(
  'public',
  'payment_transactions',
  'manually_confirmed_by',
  'manual payments record the authenticated operator'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.payment_transactions'::regclass
      and conname = 'payment_transactions_manual_confirmer_check'
      and contype = 'c'
  ),
  'manual confirmer is constrained to manual transactions'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'payment_transactions'
      and indexname = 'payment_transactions_one_active_manual_per_order_idx'
  ),
  'only one active manual transaction exists per order'
);

select * from finish();
rollback;
