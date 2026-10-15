-- Vapt business routines for Neon PostgreSQL.
-- Access is closed to PUBLIC; a dedicated API role will receive grants later.

begin;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

create or replace function public.set_order_display_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.restaurant_id::text, 0));

  select coalesce(max(display_id), 0) + 1
    into new.display_id
    from public.orders
   where restaurant_id = new.restaurant_id;

  return new;
end
$function$;

create trigger trg_set_order_display_id
before insert on public.orders
for each row execute function public.set_order_display_id();

create trigger update_restaurants_updated_at
before update on public.restaurants
for each row execute function public.update_updated_at_column();

create trigger update_menu_items_updated_at
before update on public.menu_items
for each row execute function public.update_updated_at_column();

create trigger update_orders_updated_at
before update on public.orders
for each row execute function public.update_updated_at_column();

create trigger update_payment_provider_accounts_updated_at
before update on public.payment_provider_accounts
for each row execute function public.update_updated_at_column();

create trigger update_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.update_updated_at_column();

create trigger update_payment_webhook_events_updated_at
before update on public.payment_webhook_events
for each row execute function public.update_updated_at_column();

create trigger update_payment_effect_outbox_updated_at
before update on public.payment_effect_outbox
for each row execute function public.update_updated_at_column();

create or replace function public.get_public_restaurant_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  payment_mode text,
  max_pending_orders integer,
  local_enabled boolean,
  delivery_enabled boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    restaurant.id,
    restaurant.name,
    restaurant.slug,
    restaurant.logo_url,
    restaurant.primary_color,
    restaurant.secondary_color,
    restaurant.font_family,
    restaurant.payment_mode,
    restaurant.max_pending_orders,
    restaurant.local_enabled,
    restaurant.delivery_enabled
  from public.restaurants as restaurant
  where restaurant.slug = p_slug
  limit 1;
$function$;

create or replace function public.create_public_order_v2(
  p_restaurant_slug text,
  p_channel text,
  p_table_number integer,
  p_items jsonb,
  p_delivery jsonb,
  p_public_token_hash text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns table (
  order_id uuid,
  display_id bigint,
  restaurant_id uuid,
  table_session_id uuid,
  total_price numeric,
  status text,
  payment_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.orders%rowtype;
  v_created public.orders%rowtype;
  v_menu_item public.menu_items%rowtype;
  v_item jsonb;
  v_session_id uuid;
  v_total numeric(12, 2) := 0;
  v_quantity integer;
  v_menu_item_id uuid;
  v_variation_id uuid;
  v_product_id public.order_items.product_id%type;
  v_status public.orders.status%type;
begin
  if p_channel not in ('local', 'delivery')
    or p_idempotency_key is null
    or length(trim(p_idempotency_key)) < 8
    or p_request_fingerprint is null
    or p_public_token_hash is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_order';
  end if;

  select restaurant.*
    into v_restaurant
    from public.restaurants as restaurant
   where restaurant.slug = p_restaurant_slug
   limit 1;

  if not found then
    raise exception 'restaurant_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_restaurant.id::text, 0));

  select existing_order.*
    into v_existing
    from public.orders as existing_order
   where existing_order.restaurant_id = v_restaurant.id
     and existing_order.creation_idempotency_key = p_idempotency_key
   limit 1;

  if found then
    if v_existing.creation_request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'idempotency_conflict';
    end if;

    return query
      select
        v_existing.id,
        v_existing.display_id,
        v_existing.restaurant_id,
        v_existing.table_session_id,
        v_existing.total_price,
        v_existing.status,
        v_existing.payment_status,
        true;
    return;
  end if;

  if (p_channel = 'local' and not v_restaurant.local_enabled)
    or (p_channel = 'delivery' and not v_restaurant.delivery_enabled) then
    raise exception 'channel_unavailable';
  end if;

  if p_channel = 'local' then
    if p_table_number is null or p_table_number < 1 or p_delivery is not null then
      raise exception 'invalid_order';
    end if;
  else
    if p_table_number is not null
      or p_delivery is null
      or nullif(trim(p_delivery->>'name'), '') is null
      or nullif(trim(p_delivery->>'phone'), '') is null
      or nullif(trim(p_delivery->>'street'), '') is null
      or nullif(trim(p_delivery->>'number'), '') is null
      or nullif(trim(p_delivery->>'neighborhood'), '') is null then
      raise exception 'invalid_order';
    end if;
  end if;

  if p_channel = 'local' and v_restaurant.payment_mode = 'open_tab' then
    select session.id
      into v_session_id
      from public.table_sessions as session
     where session.restaurant_id = v_restaurant.id
       and session.table_number = p_table_number::text
       and session.status in ('open', 'check_requested')
     order by session.created_at desc
     limit 1
     for update;

    if v_session_id is null then
      insert into public.table_sessions (restaurant_id, table_number, status)
      values (v_restaurant.id, p_table_number::text, 'open')
      returning id into v_session_id;
    end if;
  end if;

  v_status := case
    when p_channel = 'local' and v_restaurant.payment_mode = 'prepaid'
      then 'waiting_payment'
    else 'pending'
  end;

  insert into public.orders (
    restaurant_id,
    table_session_id,
    table_number,
    total_price,
    status,
    order_channel,
    public_access_token_hash,
    creation_idempotency_key,
    creation_request_fingerprint,
    delivery_customer_name,
    delivery_phone,
    delivery_street,
    delivery_number,
    delivery_neighborhood
  ) values (
    v_restaurant.id,
    v_session_id,
    case when p_channel = 'local' then p_table_number::text else null end,
    0,
    v_status,
    p_channel,
    p_public_token_hash,
    p_idempotency_key,
    p_request_fingerprint,
    case when p_channel = 'delivery' then trim(p_delivery->>'name') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'phone') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'street') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'number') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'neighborhood') else null end
  )
  returning * into v_created;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_menu_item_id := (v_item->>'menuItemId')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_variation_id := nullif(v_item->>'variationId', '')::uuid;
    exception when others then
      raise exception 'invalid_order';
    end;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'invalid_order';
    end if;

    select menu_item.*
      into v_menu_item
      from public.menu_items as menu_item
     where menu_item.id = v_menu_item_id
     limit 1;

    if not found or not v_menu_item.available then
      raise exception 'item_unavailable';
    end if;

    if v_menu_item.restaurant_id <> v_restaurant.id then
      raise exception 'item_restaurant_mismatch';
    end if;

    if v_variation_id is not null and not exists (
      select 1
        from public.menu_item_variations as variation
       where variation.id = v_variation_id
         and variation.menu_item_id = v_menu_item.id
    ) then
      raise exception 'invalid_order';
    end if;

    v_product_id := v_menu_item.id::text;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      notes
    ) values (
      v_created.id,
      v_product_id,
      v_menu_item.name,
      v_quantity,
      v_menu_item.price,
      coalesce(nullif(trim(v_item->>'notes'), ''), '')
    );

    v_total := v_total + (v_menu_item.price * v_quantity);
  end loop;

  update public.orders
     set total_price = v_total
   where id = v_created.id
   returning * into v_created;

  return query
    select
      v_created.id,
      v_created.display_id,
      v_created.restaurant_id,
      v_created.table_session_id,
      v_created.total_price,
      v_created.status,
      v_created.payment_status,
      false;
end
$function$;

create or replace function public.create_public_order_v3(
  p_restaurant_slug text,
  p_channel text,
  p_table_number integer,
  p_items jsonb,
  p_delivery jsonb,
  p_public_token_hash text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns table (
  order_id uuid,
  display_id bigint,
  restaurant_id uuid,
  table_session_id uuid,
  total_price numeric,
  status text,
  payment_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_order record;
  v_status text;
  v_payment_mode text;
begin
  if p_channel = 'delivery' then
    v_payment_mode := p_delivery->>'paymentMode';
    if v_payment_mode not in ('online', 'on_delivery') then
      raise exception 'invalid_order';
    end if;
  end if;

  select *
    into v_order
    from public.create_public_order_v2(
      p_restaurant_slug,
      p_channel,
      p_table_number,
      p_items,
      p_delivery,
      p_public_token_hash,
      p_idempotency_key,
      p_request_fingerprint
    );

  v_status := v_order.status;

  if p_channel = 'delivery' and v_payment_mode = 'online' then
    update public.orders as order_row
       set status = 'waiting_payment',
           payment_processing_mode = 'online'
     where order_row.id = v_order.order_id
       and order_row.status = 'pending'
       and coalesce(order_row.payment_status, '') <> 'paid'
    returning order_row.status into v_status;
  end if;

  return query
    select
      v_order.order_id::uuid,
      v_order.display_id::bigint,
      v_order.restaurant_id::uuid,
      v_order.table_session_id::uuid,
      v_order.total_price::numeric,
      coalesce(v_status, v_order.status::text),
      v_order.payment_status::text,
      v_order.idempotent_replay::boolean;
end
$function$;

create or replace function public.apply_payment_transition_v2(
  p_transaction_id uuid,
  p_expected_version integer,
  p_new_status text,
  p_provider_status text,
  p_external_payment_id text,
  p_transitioned_at timestamptz,
  p_checkout_url text,
  p_expires_at timestamptz,
  p_provider_payload jsonb,
  p_effect_types text[]
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_transaction public.payment_transactions%rowtype;
  v_transition_allowed boolean;
  v_effect_type text;
  v_effect_types text[];
begin
  if jsonb_typeof(coalesce(p_provider_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'provider payload must be a JSON object'
      using errcode = '22023';
  end if;

  select *
    into v_transaction
    from public.payment_transactions
   where id = p_transaction_id
   for update;

  if not found then
    raise exception 'payment transaction not found'
      using errcode = 'P0002';
  end if;

  if p_new_status not in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded') then
    raise exception 'invalid payment status: %', p_new_status
      using errcode = '22023';
  end if;

  if v_transaction.status <> p_new_status then
    if v_transaction.version <> p_expected_version then
      raise exception 'payment transaction version conflict'
        using errcode = '40001';
    end if;

    v_transition_allowed := case v_transaction.status
      when 'created' then p_new_status in ('pending', 'processing', 'paid', 'failed', 'cancelled')
      when 'pending' then p_new_status in ('processing', 'paid', 'failed', 'cancelled')
      when 'processing' then p_new_status in ('pending', 'paid', 'failed', 'cancelled')
      when 'paid' then p_new_status = 'refunded'
      else false
    end;

    if not v_transition_allowed then
      raise exception 'invalid payment transition: % -> %', v_transaction.status, p_new_status
        using errcode = '23514';
    end if;

    update public.payment_transactions
       set status = p_new_status,
           provider_status = coalesce(p_provider_status, provider_status),
           external_payment_id = coalesce(p_external_payment_id, external_payment_id),
           checkout_url = coalesce(p_checkout_url, checkout_url),
           expires_at = coalesce(p_expires_at, expires_at),
           provider_payload = provider_payload || coalesce(p_provider_payload, '{}'::jsonb),
           paid_at = case
             when p_new_status = 'paid' then coalesce(paid_at, p_transitioned_at)
             else paid_at
           end,
           cancelled_at = case
             when p_new_status = 'cancelled' then coalesce(cancelled_at, p_transitioned_at)
             else cancelled_at
           end,
           refunded_at = case
             when p_new_status = 'refunded' then coalesce(refunded_at, p_transitioned_at)
             else refunded_at
           end,
           version = version + 1
     where id = p_transaction_id
    returning * into v_transaction;
  end if;

  update public.orders
     set payment_transaction_id = v_transaction.id,
         payment_status = v_transaction.status,
         payment_method = v_transaction.payment_method,
         payment_processing_mode = v_transaction.processing_mode,
         payment_confirmed_at = case
           when v_transaction.status = 'paid'
             then coalesce(payment_confirmed_at, v_transaction.paid_at, p_transitioned_at)
           else payment_confirmed_at
         end
   where id = v_transaction.order_id
     and restaurant_id = v_transaction.restaurant_id;

  v_effect_types := coalesce(
    p_effect_types,
    case
      when v_transaction.status = 'paid' then array[
        'release_order_to_kitchen',
        'record_cashier_revenue',
        'notify_order_paid',
        'reconcile_operational_summary'
      ]::text[]
      else array[]::text[]
    end
  );

  foreach v_effect_type in array v_effect_types loop
    if nullif(btrim(v_effect_type), '') is not null then
      insert into public.payment_effect_outbox (
        restaurant_id,
        payment_transaction_id,
        effect_type
      ) values (
        v_transaction.restaurant_id,
        v_transaction.id,
        btrim(v_effect_type)
      )
      on conflict (payment_transaction_id, effect_type) do nothing;
    end if;
  end loop;

  return v_transaction;
end
$function$;

create or replace function public.apply_payment_transition(
  p_transaction_id uuid,
  p_expected_version integer,
  p_new_status text,
  p_provider_status text default null,
  p_external_payment_id text default null,
  p_transitioned_at timestamptz default now(),
  p_effect_types text[] default null
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_transaction public.payment_transactions%rowtype;
begin
  select *
    into v_transaction
    from public.apply_payment_transition_v2(
      p_transaction_id,
      p_expected_version,
      p_new_status,
      p_provider_status,
      p_external_payment_id,
      p_transitioned_at,
      null,
      null,
      '{}'::jsonb,
      p_effect_types
    );

  return v_transaction;
end
$function$;

create or replace function public.claim_payment_effects(
  p_worker_id text,
  p_limit integer,
  p_locked_at timestamptz,
  p_locked_until timestamptz
)
returns setof public.payment_effect_outbox
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 100 then
    raise exception 'claim limit must be between 1 and 100' using errcode = '22023';
  end if;

  if p_locked_until <= p_locked_at then
    raise exception 'lease expiration must be after claim time' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select effect.id
      from public.payment_effect_outbox as effect
     where (
       effect.status in ('pending', 'failed')
       and effect.available_at <= p_locked_at
     ) or (
       effect.status = 'processing'
       and effect.locked_until <= p_locked_at
     )
     order by effect.available_at, effect.created_at
     for update skip locked
     limit p_limit
  )
  update public.payment_effect_outbox as effect
     set status = 'processing',
         locked_at = p_locked_at,
         locked_until = p_locked_until,
         locked_by = btrim(p_worker_id)
    from candidates
   where effect.id = candidates.id
  returning effect.*;
end
$function$;

create or replace function public.complete_payment_effect(
  p_effect_id uuid,
  p_worker_id text,
  p_processed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  update public.payment_effect_outbox
     set status = 'completed',
         processed_at = p_processed_at,
         locked_at = null,
         locked_until = null,
         locked_by = null,
         last_error = null
   where id = p_effect_id
     and status = 'processing'
     and locked_by = p_worker_id;

  if not found then
    raise exception 'payment effect lease conflict' using errcode = '40001';
  end if;
end
$function$;

create or replace function public.fail_payment_effect(
  p_effect_id uuid,
  p_worker_id text,
  p_status text,
  p_attempts integer,
  p_available_at timestamptz,
  p_last_error text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_status not in ('failed', 'dead_letter') then
    raise exception 'invalid payment effect failure status' using errcode = '22023';
  end if;

  if p_attempts < 1 then
    raise exception 'payment effect attempts must be positive' using errcode = '22023';
  end if;

  update public.payment_effect_outbox
     set status = p_status,
         attempts = p_attempts,
         available_at = p_available_at,
         locked_at = null,
         locked_until = null,
         locked_by = null,
         last_error = left(coalesce(p_last_error, 'Unknown payment effect failure'), 500)
   where id = p_effect_id
     and status = 'processing'
     and locked_by = p_worker_id;

  if not found then
    raise exception 'payment effect lease conflict' using errcode = '40001';
  end if;
end
$function$;

create or replace function public.release_paid_order_to_production(
  p_payment_transaction_id uuid,
  p_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_order_id uuid;
  v_payment_status text;
begin
  select payment.order_id, payment.status
    into v_order_id, v_payment_status
    from public.payment_transactions as payment
   where payment.id = p_payment_transaction_id
     and payment.restaurant_id = p_restaurant_id;

  if not found then
    raise exception 'payment transaction not found' using errcode = 'P0002';
  end if;

  if v_payment_status <> 'paid' then
    raise exception 'payment transaction is not paid' using errcode = '23514';
  end if;

  update public.orders
     set status = 'paid'
   where id = v_order_id
     and restaurant_id = p_restaurant_id
     and status = 'waiting_payment';
end
$function$;

create or replace function public.count_pending_payment_effects()
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select count(*)
    from public.payment_effect_outbox
   where status in ('pending', 'failed')
      or (status = 'processing' and locked_until <= now());
$function$;

revoke all on function public.set_order_display_id() from public;
revoke all on function public.update_updated_at_column() from public;
revoke all on function public.get_public_restaurant_by_slug(text) from public;
revoke all on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text) from public;
revoke all on function public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text) from public;
revoke all on function public.apply_payment_transition(uuid, integer, text, text, text, timestamptz, text[]) from public;
revoke all on function public.apply_payment_transition_v2(uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]) from public;
revoke all on function public.claim_payment_effects(text, integer, timestamptz, timestamptz) from public;
revoke all on function public.complete_payment_effect(uuid, text, timestamptz) from public;
revoke all on function public.fail_payment_effect(uuid, text, text, integer, timestamptz, text) from public;
revoke all on function public.release_paid_order_to_production(uuid, uuid) from public;
revoke all on function public.count_pending_payment_effects() from public;

commit;
