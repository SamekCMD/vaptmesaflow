-- Smoke test transacional do baseline Neon.
-- Todos os dados criados por este arquivo são descartados pelo ROLLBACK final.

begin;

do $smoke$
declare
  v_restaurant_id uuid := gen_random_uuid();
  v_menu_item_id uuid := gen_random_uuid();
  v_provider_account_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_slug text := '__neon_smoke_' || replace(gen_random_uuid()::text, '-', '');
  v_idempotency_key text := 'smoke-idem-' || gen_random_uuid()::text;
  v_created record;
  v_replayed record;
  v_payment public.payment_transactions%rowtype;
  v_effect_count integer;
  v_claimed_count integer;
  v_completed_effect_id uuid;
  v_failed_effect_id uuid;
  v_pending_effects bigint;
  v_order_status text;
  v_order_payment_status text;
  v_order_payment_transaction_id uuid;
  v_updated_at timestamptz;
  v_billing_event_id text := 'evt_smoke_' || replace(gen_random_uuid()::text, '-', '');
  v_billing_status text;
  v_billing_processed_at timestamptz;
begin
  insert into public.restaurants (
    id,
    owner_id,
    name,
    slug,
    delivery_enabled,
    updated_at
  ) values (
    v_restaurant_id,
    gen_random_uuid(),
    'Neon smoke restaurant',
    v_slug,
    true,
    '2000-01-01 00:00:00+00'
  );

  insert into public.menu_items (
    id,
    restaurant_id,
    name,
    price,
    category
  ) values (
    v_menu_item_id,
    v_restaurant_id,
    'Neon smoke item',
    12.50,
    'Smoke'
  );

  select *
    into v_created
    from public.create_public_order_v3(
      v_slug,
      'delivery',
      null,
      jsonb_build_array(jsonb_build_object(
        'menuItemId', v_menu_item_id,
        'quantity', 2
      )),
      jsonb_build_object(
        'name', 'Smoke Customer',
        'phone', '00000000000',
        'street', 'Smoke Street',
        'number', '1',
        'neighborhood', 'Smoke',
        'paymentMode', 'online'
      ),
      'smoke-public-token-hash',
      v_idempotency_key,
      'smoke-request-fingerprint'
    );

  if v_created.restaurant_id <> v_restaurant_id
    or v_created.total_price <> 25.00
    or v_created.status <> 'waiting_payment'
    or v_created.idempotent_replay then
    raise exception 'unexpected public order result: %', row_to_json(v_created);
  end if;

  select *
    into v_replayed
    from public.create_public_order_v3(
      v_slug,
      'delivery',
      null,
      jsonb_build_array(jsonb_build_object(
        'menuItemId', v_menu_item_id,
        'quantity', 2
      )),
      jsonb_build_object(
        'name', 'Smoke Customer',
        'phone', '00000000000',
        'street', 'Smoke Street',
        'number', '1',
        'neighborhood', 'Smoke',
        'paymentMode', 'online'
      ),
      'smoke-public-token-hash',
      v_idempotency_key,
      'smoke-request-fingerprint'
    );

  if v_replayed.order_id <> v_created.order_id
    or not v_replayed.idempotent_replay
    or (select count(*) from public.orders where restaurant_id = v_restaurant_id) <> 1
    or (select count(*) from public.order_items where order_id = v_created.order_id) <> 1 then
    raise exception 'public order idempotency check failed';
  end if;

  update public.restaurants
     set name = name
   where id = v_restaurant_id
  returning updated_at into v_updated_at;

  if v_updated_at <= '2000-01-01 00:00:00+00'::timestamptz then
    raise exception 'updated_at trigger did not run';
  end if;

  insert into public.payment_provider_accounts (
    id,
    restaurant_id,
    provider,
    environment,
    status
  ) values (
    v_provider_account_id,
    v_restaurant_id,
    'mercado_pago',
    'sandbox',
    'active'
  );

  insert into public.payment_transactions (
    id,
    restaurant_id,
    order_id,
    provider_account_id,
    provider,
    idempotency_key,
    request_fingerprint,
    amount,
    status,
    payment_method,
    processing_mode
  ) values (
    v_transaction_id,
    v_restaurant_id,
    v_created.order_id,
    v_provider_account_id,
    'mercado_pago',
    'smoke-payment-' || gen_random_uuid()::text,
    'smoke-payment-fingerprint',
    25.00,
    'created',
    'pix',
    'online'
  );

  select *
    into v_payment
    from public.apply_payment_transition_v2(
      v_transaction_id,
      1,
      'paid',
      'approved',
      'smoke-external-' || gen_random_uuid()::text,
      now(),
      'https://example.invalid/smoke-checkout',
      now() + interval '15 minutes',
      '{"smoke": true}'::jsonb,
      null
    );

  if v_payment.status <> 'paid' or v_payment.version <> 2 then
    raise exception 'payment transition failed: %', row_to_json(v_payment);
  end if;

  select count(*)
    into v_effect_count
    from public.payment_effect_outbox
   where payment_transaction_id = v_transaction_id;

  if v_effect_count <> 4 then
    raise exception 'expected 4 payment effects, got %', v_effect_count;
  end if;

  perform public.apply_payment_transition_v2(
    v_transaction_id,
    1,
    'paid',
    'approved',
    v_payment.external_payment_id,
    now(),
    v_payment.checkout_url,
    v_payment.expires_at,
    '{"smokeReplay": true}'::jsonb,
    null
  );

  if (select count(*) from public.payment_effect_outbox
       where payment_transaction_id = v_transaction_id) <> 4 then
    raise exception 'payment replay duplicated outbox effects';
  end if;

  perform public.release_paid_order_to_production(v_transaction_id, v_restaurant_id);

  select status, payment_status, payment_transaction_id
    into v_order_status, v_order_payment_status, v_order_payment_transaction_id
    from public.orders
   where id = v_created.order_id;

  if v_order_status <> 'paid'
    or v_order_payment_status <> 'paid'
    or v_order_payment_transaction_id <> v_transaction_id then
    raise exception 'paid order was not released correctly';
  end if;

  select count(*)
    into v_claimed_count
    from public.claim_payment_effects(
      'neon-smoke-worker',
      100,
      now(),
      now() + interval '5 minutes'
    );

  if v_claimed_count <> 4 then
    raise exception 'expected to claim 4 effects, got %', v_claimed_count;
  end if;

  select id
    into v_completed_effect_id
    from public.payment_effect_outbox
   where payment_transaction_id = v_transaction_id
   order by effect_type
   limit 1;

  select id
    into v_failed_effect_id
    from public.payment_effect_outbox
   where payment_transaction_id = v_transaction_id
     and id <> v_completed_effect_id
   order by effect_type
   limit 1;

  perform public.complete_payment_effect(
    v_completed_effect_id,
    'neon-smoke-worker',
    now()
  );

  perform public.fail_payment_effect(
    v_failed_effect_id,
    'neon-smoke-worker',
    'failed',
    1,
    now() + interval '1 minute',
    'intentional smoke failure'
  );

  select public.count_pending_payment_effects()
    into v_pending_effects;

  if v_pending_effects <> 1 then
    raise exception 'expected 1 pending/failed effect after lease checks, got %', v_pending_effects;
  end if;

  -- Billing state and intent persistence stay in the same rollback-only smoke.
  update public.restaurants
     set stripe_customer_id = 'cus_smoke_' || v_restaurant_id::text,
         stripe_subscription_id = 'sub_smoke_' || v_restaurant_id::text,
         stripe_checkout_session_id = 'cs_test_smoke',
         stripe_checkout_plan_type = 'starter',
         stripe_checkout_expires_at = now() + interval '1 hour'
   where id = v_restaurant_id;

  begin
    insert into public.restaurants (owner_id, name, slug, stripe_customer_id)
    values (gen_random_uuid(), 'Duplicate customer', v_slug || '_customer',
      'cus_smoke_' || v_restaurant_id::text);
    raise exception 'Stripe Customer was associated with two restaurants';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.restaurants (owner_id, name, slug, stripe_subscription_id)
    values (gen_random_uuid(), 'Duplicate subscription', v_slug || '_subscription',
      'sub_smoke_' || v_restaurant_id::text);
    raise exception 'Stripe Subscription was associated with two restaurants';
  exception when unique_violation then
    null;
  end;

  begin
    update public.restaurants set plan_status = 'not_a_status' where id = v_restaurant_id;
    raise exception 'invalid billing status was accepted';
  exception when check_violation then
    null;
  end;

  insert into public.billing_provider_events (
    provider, provider_event_id, event_type, restaurant_id, payload
  ) values ('stripe', v_billing_event_id, 'invoice.paid', v_restaurant_id, '{}'::jsonb);

  select processing_status, processed_at into v_billing_status, v_billing_processed_at
    from public.billing_provider_events
   where provider = 'stripe' and provider_event_id = v_billing_event_id;
  if v_billing_status <> 'received' or v_billing_processed_at is not null then
    raise exception 'new billing event was incorrectly marked as processed';
  end if;

  update public.billing_provider_events
     set processing_status = 'pending_retry', attempt_count = 1,
         last_error = 'intentional_smoke_failure'
   where provider = 'stripe' and provider_event_id = v_billing_event_id;
  update public.billing_provider_events
     set processing_status = 'processing', attempt_count = attempt_count + 1,
         processing_started_at = now(), last_error = null
   where provider = 'stripe' and provider_event_id = v_billing_event_id
     and processing_status = 'pending_retry';
  if not found then
    raise exception 'pending billing event could not be retried';
  end if;

  insert into public.billing_email_outbox (restaurant_id, provider_event_id, email_kind, billing_resource_id, payload)
  values (v_restaurant_id, v_billing_event_id, 'subscription_activated', 'in_billing_smoke',
    jsonb_build_object('planType', 'starter'))
  on conflict do nothing;
  insert into public.billing_email_outbox (restaurant_id, provider_event_id, email_kind, billing_resource_id, payload)
  values (v_restaurant_id, v_billing_event_id || '_second', 'subscription_activated', 'in_billing_smoke',
    jsonb_build_object('planType', 'starter'))
  on conflict do nothing;
  if (select count(*) from public.billing_email_outbox
       where provider_event_id = v_billing_event_id) <> 1 then
    raise exception 'billing email intent was duplicated';
  end if;

  update public.billing_provider_events
     set processing_status = 'processed', processed_at = now(), processing_started_at = null
   where provider = 'stripe' and provider_event_id = v_billing_event_id;
end
$smoke$;

rollback;
