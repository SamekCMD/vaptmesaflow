begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(2);

insert into public.restaurants (
  id,
  owner_id,
  name,
  slug,
  local_enabled,
  delivery_enabled
)
select
  '10000000-0000-4000-8000-000000000091'::uuid,
  restaurant.owner_id,
  'Restaurante enum de teste',
  'restaurante-enum-de-teste',
  true,
  true
from public.restaurants as restaurant
limit 1;

insert into public.menu_items (id, restaurant_id, name, price, category, available)
values (
  '10000000-0000-4000-8000-000000000092'::uuid,
  '10000000-0000-4000-8000-000000000091'::uuid,
  'Item enum de teste',
  23.00,
  'Teste',
  true
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select results_eq(
  $$
    select status, total_price, idempotent_replay
      from public.create_public_order_v2(
        'restaurante-enum-de-teste',
        'delivery',
        null,
        '[{"menuItemId":"10000000-0000-4000-8000-000000000092","quantity":1}]'::jsonb,
        '{"name":"Cliente Teste","phone":"61999999999","street":"Rua Teste","number":"1","neighborhood":"Centro"}'::jsonb,
        'enum-public-token-hash',
        'enum-idempotency-key',
        'enum-request-fingerprint'
      )
  $$,
  $$ values ('pending'::text, 23.00::numeric, false) $$,
  'order creation accepts the database status type and returns text safely'
);

select results_eq(
  $$
    select status, total_price, idempotent_replay
      from public.create_public_order_v2(
        'restaurante-enum-de-teste',
        'delivery',
        null,
        '[{"menuItemId":"10000000-0000-4000-8000-000000000092","quantity":1}]'::jsonb,
        '{"name":"Cliente Teste","phone":"61999999999","street":"Rua Teste","number":"1","neighborhood":"Centro"}'::jsonb,
        'enum-public-token-hash',
        'enum-idempotency-key',
        'enum-request-fingerprint'
      )
  $$,
  $$ values ('pending'::text, 23.00::numeric, true) $$,
  'idempotent replay also returns enum-backed statuses as text'
);

reset role;
select * from finish();
rollback;
