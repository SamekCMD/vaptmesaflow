begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(17);

select ok(to_regprocedure('public.claim_payment_effects(text,integer,timestamptz,timestamptz)') is not null, 'claim function exists');
select ok(to_regprocedure('public.complete_payment_effect(uuid,text,timestamptz)') is not null, 'completion function exists');
select ok(to_regprocedure('public.fail_payment_effect(uuid,text,text,integer,timestamptz,text)') is not null, 'failure function exists');
select ok(to_regprocedure('public.release_paid_order_to_production(uuid,uuid)') is not null, 'production release function exists');
select ok(to_regprocedure('public.count_pending_payment_effects()') is not null, 'pending count function exists');

select ok(has_function_privilege('service_role', 'public.claim_payment_effects(text,integer,timestamp with time zone,timestamp with time zone)', 'execute'), 'service role can claim effects');
select ok(has_function_privilege('service_role', 'public.complete_payment_effect(uuid,text,timestamp with time zone)', 'execute'), 'service role can complete effects');
select ok(has_function_privilege('service_role', 'public.fail_payment_effect(uuid,text,text,integer,timestamp with time zone,text)', 'execute'), 'service role can fail effects');
select ok(has_function_privilege('service_role', 'public.release_paid_order_to_production(uuid,uuid)', 'execute'), 'service role can release paid orders');
select ok(has_function_privilege('service_role', 'public.count_pending_payment_effects()', 'execute'), 'service role can count pending effects');

select ok(not has_function_privilege('anon', 'public.claim_payment_effects(text,integer,timestamp with time zone,timestamp with time zone)', 'execute'), 'anon cannot claim effects');
select ok(not has_function_privilege('authenticated', 'public.complete_payment_effect(uuid,text,timestamp with time zone)', 'execute'), 'authenticated users cannot complete effects');
select ok(not has_function_privilege('anon', 'public.fail_payment_effect(uuid,text,text,integer,timestamp with time zone,text)', 'execute'), 'anon cannot fail effects');
select ok(not has_function_privilege('authenticated', 'public.release_paid_order_to_production(uuid,uuid)', 'execute'), 'authenticated users cannot release paid orders');
select ok(not has_function_privilege('anon', 'public.count_pending_payment_effects()', 'execute'), 'anon cannot inspect the effect backlog');

select ok(
  position(
    'for update skip locked' in
    lower(pg_get_functiondef('public.claim_payment_effects(text,integer,timestamptz,timestamptz)'::regprocedure))
  ) > 0,
  'claiming effects uses skip locked'
);

select ok(
  position(
    'status = ''waiting_payment''' in
    lower(pg_get_functiondef('public.release_paid_order_to_production(uuid,uuid)'::regprocedure))
  ) > 0,
  'production release only advances orders waiting for payment'
);

select * from finish();

rollback;
