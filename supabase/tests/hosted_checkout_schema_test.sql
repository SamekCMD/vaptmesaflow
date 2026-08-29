begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(8);

select ok(
  to_regprocedure('public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])') is not null,
  'hosted checkout transition function exists'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamp with time zone,text,timestamp with time zone,jsonb,text[])',
    'execute'
  ),
  'service role can persist hosted checkout transitions'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamp with time zone,text,timestamp with time zone,jsonb,text[])',
    'execute'
  ),
  'anon cannot persist hosted checkout transitions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamp with time zone,text,timestamp with time zone,jsonb,text[])',
    'execute'
  ),
  'authenticated users cannot persist hosted checkout transitions'
);

select ok(
  position('checkout_url = coalesce(p_checkout_url, checkout_url)' in lower(pg_get_functiondef('public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])'::regprocedure))) > 0,
  'transition persists the provider checkout URL'
);

select ok(
  position('expires_at = coalesce(p_expires_at, expires_at)' in lower(pg_get_functiondef('public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])'::regprocedure))) > 0,
  'transition persists checkout expiration'
);

select ok(
  position('provider_payload = provider_payload || coalesce(p_provider_payload' in lower(pg_get_functiondef('public.apply_payment_transition_v2(uuid,integer,text,text,text,timestamptz,text,timestamptz,jsonb,text[])'::regprocedure))) > 0,
  'transition merges provider metadata without exposing it publicly'
);

select ok(
  to_regprocedure('public.apply_payment_transition(uuid,integer,text,text,text,timestamptz,text[])') is not null,
  'legacy transition remains available during compatibility period'
);

select * from finish();

rollback;
