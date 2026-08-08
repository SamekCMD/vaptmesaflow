begin;

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
  display_id integer,
  restaurant_id uuid,
  table_session_id uuid,
  total_price numeric,
  status text,
  payment_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.orders%rowtype;
  v_created public.orders%rowtype;
  v_menu_item public.menu_items%rowtype;
  v_item jsonb;
  v_session_id uuid;
  v_total numeric(10,2) := 0;
  v_quantity integer;
  v_menu_item_id uuid;
  v_variation_id uuid;
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
        v_existing.status::text,
        v_existing.payment_status::text,
        true;
    return;
  end if;

  if (p_channel = 'local' and not v_restaurant.local_enabled)
    or (p_channel = 'delivery' and not v_restaurant.delivery_enabled) then
    raise exception 'channel_unavailable';
  end if;

  if p_channel = 'local' then
    if p_table_number is null or p_table_number < 1 then
      raise exception 'invalid_order';
    end if;
    if p_delivery is not null then
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
    when p_channel = 'local' and v_restaurant.payment_mode = 'prepaid' then 'waiting_payment'
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

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      notes
    ) values (
      v_created.id,
      v_menu_item.id::text,
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
      v_created.status::text,
      v_created.payment_status::text,
      false;
end;
$$;

revoke all on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  to service_role;

commit;
