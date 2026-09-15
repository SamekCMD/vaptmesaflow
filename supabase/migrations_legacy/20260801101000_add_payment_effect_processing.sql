begin;

create index if not exists payment_effect_outbox_expired_lease_idx
  on public.payment_effect_outbox (locked_until)
  where status = 'processing';

create or replace function public.claim_payment_effects(
  p_worker_id text,
  p_limit integer,
  p_locked_at timestamptz,
  p_locked_until timestamptz
)
returns setof public.payment_effect_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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
    from public.payment_effect_outbox effect
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
  update public.payment_effect_outbox effect
  set status = 'processing',
      locked_at = p_locked_at,
      locked_until = p_locked_until,
      locked_by = btrim(p_worker_id)
  from candidates
  where effect.id = candidates.id
  returning effect.*;
end;
$$;

create or replace function public.complete_payment_effect(
  p_effect_id uuid,
  p_worker_id text,
  p_processed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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
end;
$$;

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
set search_path = public, pg_catalog
as $$
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
end;
$$;

create or replace function public.release_paid_order_to_production(
  p_payment_transaction_id uuid,
  p_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id uuid;
  v_payment_status text;
begin
  select payment.order_id, payment.status
  into v_order_id, v_payment_status
  from public.payment_transactions payment
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
end;
$$;

create or replace function public.count_pending_payment_effects()
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)
  from public.payment_effect_outbox
  where status in ('pending', 'failed')
    or (status = 'processing' and locked_until <= now());
$$;

revoke all on function public.claim_payment_effects(text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_payment_effect(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_payment_effect(uuid, text, text, integer, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.release_paid_order_to_production(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.count_pending_payment_effects()
  from public, anon, authenticated;

grant execute on function public.claim_payment_effects(text, integer, timestamptz, timestamptz)
  to service_role;
grant execute on function public.complete_payment_effect(uuid, text, timestamptz)
  to service_role;
grant execute on function public.fail_payment_effect(uuid, text, text, integer, timestamptz, text)
  to service_role;
grant execute on function public.release_paid_order_to_production(uuid, uuid)
  to service_role;
grant execute on function public.count_pending_payment_effects()
  to service_role;

commit;
