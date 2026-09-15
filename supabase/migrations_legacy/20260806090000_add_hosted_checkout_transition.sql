begin;

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
set search_path = public, pg_catalog
as $$
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
        when v_transaction.status = 'paid' then coalesce(payment_confirmed_at, v_transaction.paid_at, p_transitioned_at)
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
end;
$$;

revoke all on function public.apply_payment_transition_v2(
  uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]
) from public, anon, authenticated;

grant execute on function public.apply_payment_transition_v2(
  uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]
) to service_role;

commit;
