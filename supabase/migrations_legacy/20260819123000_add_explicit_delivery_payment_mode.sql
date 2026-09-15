begin;

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
set search_path = public, pg_temp
as $$
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
    update public.orders
       set status = 'waiting_payment',
           payment_processing_mode = 'online'
     where id = v_order.order_id
       and status = 'pending'
       and coalesce(payment_status::text, '') <> 'paid'
    returning orders.status::text into v_status;
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
end;
$$;

revoke all on function public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text)
  to service_role;

commit;
