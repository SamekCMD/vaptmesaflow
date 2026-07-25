-- O modelo V2 convive com Asaas/n8n ate a conclusao da migracao por etapas.
-- Nenhuma tabela ou coluna financeira legada e removida nesta migration.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_id_restaurant_id_key'
  ) then
    alter table public.orders
      add constraint orders_id_restaurant_id_key unique (id, restaurant_id);
  end if;
end;
$$;

create table public.payment_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  provider text not null,
  environment text not null default 'production',
  status text not null default 'disconnected',
  external_account_id text,
  capabilities jsonb not null default '{}'::jsonb,
  access_token_encrypted text,
  refresh_token_encrypted text,
  credential_key_id text,
  token_expires_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_error text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_provider_accounts_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants(id) on delete cascade,
  constraint payment_provider_accounts_provider_check
    check (provider in ('manual', 'mercado_pago', 'asaas_legacy')),
  constraint payment_provider_accounts_environment_check
    check (environment in ('sandbox', 'production')),
  constraint payment_provider_accounts_status_check
    check (status in ('disconnected', 'connecting', 'active', 'error')),
  constraint payment_provider_accounts_version_check
    check (version > 0),
  constraint payment_provider_accounts_restaurant_provider_environment_key
    unique (restaurant_id, provider, environment),
  constraint payment_provider_accounts_id_restaurant_id_key
    unique (id, restaurant_id)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  provider_account_id uuid,
  provider text not null,
  external_payment_id text,
  idempotency_key text not null,
  request_fingerprint text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'BRL',
  status text not null default 'created',
  provider_status text,
  payment_method text,
  processing_mode text not null,
  checkout_url text,
  provider_payload jsonb not null default '{}'::jsonb,
  failure_code text,
  failure_message text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_order_tenant_fkey
    foreign key (order_id, restaurant_id)
    references public.orders(id, restaurant_id) on delete restrict,
  constraint payment_transactions_provider_account_tenant_fkey
    foreign key (provider_account_id, restaurant_id)
    references public.payment_provider_accounts(id, restaurant_id) on delete restrict,
  constraint payment_transactions_provider_check
    check (provider in ('manual', 'mercado_pago', 'asaas_legacy')),
  constraint payment_transactions_amount_check
    check (amount > 0),
  constraint payment_transactions_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_status_check
    check (status in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  constraint payment_transactions_processing_mode_check
    check (processing_mode in ('manual', 'online', 'legacy')),
  constraint payment_transactions_version_check
    check (version > 0),
  constraint payment_transactions_restaurant_id_idempotency_key_key
    unique (restaurant_id, idempotency_key),
  constraint payment_transactions_id_restaurant_id_key
    unique (id, restaurant_id)
);

create unique index payment_transactions_provider_external_payment_id_uidx
  on public.payment_transactions (provider, external_payment_id)
  where external_payment_id is not null;

alter table public.orders
  add column if not exists payment_transaction_id uuid,
  add column if not exists payment_method text,
  add column if not exists payment_processing_mode text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_transaction_tenant_fkey'
  ) then
    alter table public.orders
      add constraint orders_payment_transaction_tenant_fkey
      foreign key (payment_transaction_id, restaurant_id)
      references public.payment_transactions(id, restaurant_id)
      on delete restrict;
  end if;
end;
$$;

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  restaurant_id uuid,
  provider_account_id uuid,
  payment_transaction_id uuid,
  signature_valid boolean,
  status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_webhook_events_provider_account_tenant_fkey
    foreign key (provider_account_id, restaurant_id)
    references public.payment_provider_accounts(id, restaurant_id) on delete restrict,
  constraint payment_webhook_events_transaction_tenant_fkey
    foreign key (payment_transaction_id, restaurant_id)
    references public.payment_transactions(id, restaurant_id) on delete restrict,
  constraint payment_webhook_events_provider_check
    check (provider in ('mercado_pago', 'asaas_legacy')),
  constraint payment_webhook_events_status_check
    check (status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  constraint payment_webhook_events_attempts_check
    check (attempts >= 0),
  constraint payment_webhook_events_account_requires_tenant_check
    check (provider_account_id is null or restaurant_id is not null),
  constraint payment_webhook_events_transaction_requires_tenant_check
    check (payment_transaction_id is null or restaurant_id is not null),
  constraint payment_webhook_events_provider_external_event_id_key
    unique (provider, external_event_id)
);

create table public.payment_oauth_states (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  provider text not null,
  environment text not null default 'production',
  state_hash text not null unique,
  code_verifier_encrypted text not null,
  credential_key_id text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_oauth_states_restaurant_id_fkey
    foreign key (restaurant_id) references public.restaurants(id) on delete cascade,
  constraint payment_oauth_states_provider_check
    check (provider = 'mercado_pago'),
  constraint payment_oauth_states_environment_check
    check (environment in ('sandbox', 'production')),
  constraint payment_oauth_states_expiration_check
    check (expires_at > created_at),
  constraint payment_oauth_states_consumed_check
    check (consumed_at is null or consumed_at >= created_at)
);

create table public.payment_effect_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  payment_transaction_id uuid not null,
  effect_type text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_effect_outbox_transaction_tenant_fkey
    foreign key (payment_transaction_id, restaurant_id)
    references public.payment_transactions(id, restaurant_id) on delete cascade,
  constraint payment_effect_outbox_status_check
    check (status in ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  constraint payment_effect_outbox_attempts_check
    check (attempts >= 0),
  constraint payment_effect_outbox_lease_check
    check (locked_until is null or locked_at is not null),
  constraint payment_effect_outbox_transaction_effect_type_key
    unique (payment_transaction_id, effect_type)
);

create index payment_provider_accounts_restaurant_idx
  on public.payment_provider_accounts (restaurant_id, status);
create index payment_transactions_order_idx
  on public.payment_transactions (order_id, created_at desc);
create index payment_transactions_restaurant_status_idx
  on public.payment_transactions (restaurant_id, status, created_at desc);
create index payment_webhook_events_pending_idx
  on public.payment_webhook_events (status, received_at)
  where status in ('received', 'failed');
create index payment_oauth_states_expiration_idx
  on public.payment_oauth_states (expires_at)
  where consumed_at is null;
create index payment_effect_outbox_available_idx
  on public.payment_effect_outbox (available_at, created_at)
  where status in ('pending', 'failed');

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

alter table public.payment_provider_accounts enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.payment_oauth_states enable row level security;
alter table public.payment_effect_outbox enable row level security;

alter table public.payment_provider_accounts force row level security;
alter table public.payment_transactions force row level security;
alter table public.payment_webhook_events force row level security;
alter table public.payment_oauth_states force row level security;
alter table public.payment_effect_outbox force row level security;

revoke all on table public.payment_provider_accounts from anon, authenticated;
revoke all on table public.payment_transactions from anon, authenticated;
revoke all on table public.payment_webhook_events from anon, authenticated;
revoke all on table public.payment_oauth_states from anon, authenticated;
revoke all on table public.payment_effect_outbox from anon, authenticated;

grant select, insert, update, delete on table public.payment_provider_accounts to service_role;
grant select, insert, update, delete on table public.payment_transactions to service_role;
grant select, insert, update, delete on table public.payment_webhook_events to service_role;
grant select, insert, update, delete on table public.payment_oauth_states to service_role;
grant select, insert, update, delete on table public.payment_effect_outbox to service_role;

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
set search_path = public, pg_catalog
as $$
declare
  v_transaction public.payment_transactions%rowtype;
  v_transition_allowed boolean;
  v_effect_type text;
  v_effect_types text[];
begin
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

revoke all on function public.apply_payment_transition(
  uuid,
  integer,
  text,
  text,
  text,
  timestamptz,
  text[]
) from public, anon, authenticated;

grant execute on function public.apply_payment_transition(
  uuid,
  integer,
  text,
  text,
  text,
  timestamptz,
  text[]
) to service_role;
