-- Executar depois de 002_business_routines.sql no database `vapt`.

do $verify$
declare
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
  expected_triggers constant text[] := array[
    'trg_set_order_display_id',
    'update_restaurants_updated_at',
    'update_menu_items_updated_at',
    'update_orders_updated_at',
    'update_payment_provider_accounts_updated_at',
    'update_payment_transactions_updated_at',
    'update_payment_webhook_events_updated_at',
    'update_payment_effect_outbox_updated_at'
  ];
  missing_routines text[];
  missing_triggers text[];
begin
  select array_agg(signature order by signature)
    into missing_routines
    from unnest(expected_routines) as expected(signature)
   where to_regprocedure(signature) is null;

  if coalesce(cardinality(missing_routines), 0) > 0 then
    raise exception 'Neon baseline missing routines: %', array_to_string(missing_routines, ', ');
  end if;

  select array_agg(trigger_name order by trigger_name)
    into missing_triggers
    from unnest(expected_triggers) as expected(trigger_name)
   where not exists (
     select 1
       from pg_trigger
      where tgname = trigger_name
        and not tgisinternal
   );

  if coalesce(cardinality(missing_triggers), 0) > 0 then
    raise exception 'Neon baseline missing triggers: %', array_to_string(missing_triggers, ', ');
  end if;
end
$verify$;
