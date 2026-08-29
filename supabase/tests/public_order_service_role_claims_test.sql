begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select plan(4);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_public_order_v2(text,text,integer,jsonb,jsonb,text,text,text)',
    'execute'
  ),
  'anon cannot create orders through the internal RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_public_order_v2(text,text,integer,jsonb,jsonb,text,text,text)',
    'execute'
  ),
  'authenticated users cannot create orders through the internal RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_public_order_v2(text,text,integer,jsonb,jsonb,text,text,text)',
    'execute'
  ),
  'service role can create orders through the internal RPC'
);

select set_config(
  'request.jwt.claims',
  '{"role":"service_role"}',
  true
);
set local role service_role;

select throws_ok(
  $$
    select *
      from public.create_public_order_v2(
        'restaurante-inexistente-para-teste',
        'delivery',
        null,
        '[{"menuItemId":"10000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,
        '{"name":"Cliente Teste","phone":"61999999999","street":"Rua Teste","number":"1","neighborhood":"Centro"}'::jsonb,
        'public-token-hash-de-teste',
        'idempotency-key-de-teste',
        'request-fingerprint-de-teste'
      )
  $$,
  'P0001',
  'restaurant_not_found',
  'service role reaches restaurant lookup when PostgREST provides consolidated claims'
);

reset role;

select * from finish();

rollback;
