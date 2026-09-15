-- Nenhuma tabela ou coluna financeira legada e removida nesta migration.

-- A migration deve funcionar mesmo sem o bootstrap historico do Lovable.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
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
    check (provider in ('manual', 'mercado_pago')),
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
    check (provider in ('manual', 'mercado_pago')),
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

create unique index if not exists payment_transactions_provider_external_payment_id_uidx
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
    check (provider in ('mercado_pago')),
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

create index if not exists payment_provider_accounts_restaurant_idx
  on public.payment_provider_accounts (restaurant_id, status);
create index if not exists payment_transactions_order_idx
  on public.payment_transactions (order_id, created_at desc);
create index if not exists payment_transactions_restaurant_status_idx
  on public.payment_transactions (restaurant_id, status, created_at desc);
create index if not exists payment_webhook_events_pending_idx
  on public.payment_webhook_events (status, received_at)
  where status in ('received', 'failed');
create index if not exists payment_oauth_states_expiration_idx
  on public.payment_oauth_states (expires_at)
  where consumed_at is null;
create index if not exists payment_effect_outbox_available_idx
  on public.payment_effect_outbox (available_at, created_at)
  where status in ('pending', 'failed');

drop trigger if exists update_payment_provider_accounts_updated_at on public.payment_provider_accounts;
create trigger update_payment_provider_accounts_updated_at
before update on public.payment_provider_accounts
for each row execute function public.update_updated_at_column();

drop trigger if exists update_payment_transactions_updated_at on public.payment_transactions;
create trigger update_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_payment_webhook_events_updated_at on public.payment_webhook_events;
create trigger update_payment_webhook_events_updated_at
before update on public.payment_webhook_events
for each row execute function public.update_updated_at_column();

drop trigger if exists update_payment_effect_outbox_updated_at on public.payment_effect_outbox;
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


-- A confirmacao manual sempre registra o operador autenticado.
alter table public.payment_transactions
  add column if not exists manually_confirmed_by uuid;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_manual_confirmer_check;

alter table public.payment_transactions
  add constraint payment_transactions_manual_confirmer_check
  check (
    (provider = 'manual' and manually_confirmed_by is not null)
    or (provider <> 'manual' and manually_confirmed_by is null)
  );

-- Uma troca de chave idempotente nao pode confirmar novamente o mesmo pedido.
create unique index if not exists payment_transactions_one_active_manual_per_order_idx
  on public.payment_transactions (order_id)
  where provider = 'manual'
    and status in ('created', 'pending', 'processing', 'paid');

comment on column public.payment_transactions.manually_confirmed_by is
  'JWT sub do operador que confirmou um recebimento manual.';

notify pgrst, 'reload schema';
