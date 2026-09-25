-- Executar no database `vapt` da branch Neon alvo.
-- A verificação é somente leitura e falha com uma lista explícita de objetos ausentes.

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
  missing_tables text[];
begin
  select array_agg(table_name order by table_name)
    into missing_tables
    from unnest(expected_tables) as expected(table_name)
   where to_regclass(format('public.%I', table_name)) is null;

  if coalesce(cardinality(missing_tables), 0) > 0 then
    raise exception 'Neon baseline missing tables: %', array_to_string(missing_tables, ', ');
  end if;
end
$verify$;
