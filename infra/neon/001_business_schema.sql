-- Vapt business schema for Neon PostgreSQL.
-- Target: database `vapt`, branch `preview` first.
-- This is an empty-database baseline, not a replay of Supabase migrations.
-- Authentication, authorization, object storage and realtime are outside this schema.

begin;

create extension if not exists pgcrypto;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  slug text not null unique,
  cnpj text,
  whatsapp text,
  address text,
  phone text,
  hours text,
  description text,
  primary_color text not null default '#5C8A72',
  secondary_color text not null default '#111114',
  font_family text not null default 'modern',
  logo_url text,
  plan_type text not null default 'starter',
  plan_status text not null default 'trialing',
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  total_tables integer not null default 1,
  max_tables integer not null default 1,
  payment_mode text not null default 'open_tab',
  max_pending_orders integer not null default 3,
  local_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  asaas_api_key text,
  asaas_billing_document text,
  asaas_environment text not null default 'production',
  asaas_setup_status text,
  asaas_webhook_id text,
  asaas_webhook_url text,
  asaas_webhook_token text,
  asaas_last_validated_at timestamptz,
  asaas_last_error text,
  billing_last_error text,
  subscription_canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_payment_mode_check
    check (payment_mode in ('open_tab', 'prepaid')),
  constraint restaurants_asaas_environment_check
    check (asaas_environment in ('production', 'sandbox'))
);

create index restaurants_owner_id_idx
  on public.restaurants (owner_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  description text,
  category text not null default 'Geral',
  available boolean not null default true,
  image_url text,
  available_from text,
  available_until text,
  badge text,
  is_chef_suggestion boolean not null default false,
  prep_time_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_price_check check (price >= 0),
  constraint menu_items_prep_time_check
    check (prep_time_minutes is null or prep_time_minutes >= 0)
);

create index menu_items_restaurant_idx
  on public.menu_items (restaurant_id, category, available);

create table public.menu_item_variations (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  options text[] not null default '{}',
  required boolean not null default false,
  created_at timestamptz not null default now()
);

create index menu_item_variations_menu_item_idx
  on public.menu_item_variations (menu_item_id);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null,
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint table_sessions_status_check
    check (status in ('open', 'check_requested', 'closed'))
);

create index table_sessions_restaurant_status_idx
  on public.table_sessions (restaurant_id, status, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_session_id uuid references public.table_sessions(id) on delete set null,
  table_number text,
  display_id bigint,
  total_price numeric(12, 2) not null default 0,
  status text not null default 'pending',
  payment_status text,
  payment_confirmed_at timestamptz,
  payment_transaction_id uuid,
  payment_method text,
  payment_processing_mode text,
  order_channel text not null default 'local',
  public_access_token_hash text,
  creation_idempotency_key text,
  creation_request_fingerprint text,
  delivery_customer_name text,
  delivery_phone text,
  delivery_street text,
  delivery_number text,
  delivery_neighborhood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_id_restaurant_id_key unique (id, restaurant_id),
  constraint orders_order_channel_check
    check (order_channel in ('local', 'delivery')),
  constraint orders_total_price_check check (total_price >= 0)
);

create unique index orders_restaurant_idempotency_key_idx
  on public.orders (restaurant_id, creation_idempotency_key)
  where creation_idempotency_key is not null;
create index orders_public_access_token_idx
  on public.orders (id, public_access_token_hash)
  where public_access_token_hash is not null;
create index orders_restaurant_status_created_idx
  on public.orders (restaurant_id, status, created_at desc);
create index orders_table_session_idx
  on public.orders (table_session_id, created_at)
  where table_session_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric(12, 2) not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_unit_price_check check (unit_price >= 0)
);

create index order_items_order_idx
  on public.order_items (order_id, created_at);

create table public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating integer not null,
  reasons text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  constraint order_feedback_rating_check check (rating between 1 and 5)
);

create index order_feedback_restaurant_created_at_idx
  on public.order_feedback (restaurant_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  origin text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_restaurant_idx
  on public.push_subscriptions (restaurant_id);

create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payment_provider_events_provider_event_key
    unique (provider, provider_event_id)
);

create index payment_provider_events_restaurant_idx
  on public.payment_provider_events (restaurant_id, created_at desc);

create table public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint billing_provider_events_provider_event_key
    unique (provider, provider_event_id)
);

create index billing_provider_events_restaurant_idx
  on public.billing_provider_events (restaurant_id, created_at desc);

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
  constraint payment_provider_accounts_version_check check (version > 0),
  constraint payment_provider_accounts_restaurant_provider_environment_key
    unique (restaurant_id, provider, environment),
  constraint payment_provider_accounts_id_restaurant_id_key
    unique (id, restaurant_id)
);

create index payment_provider_accounts_restaurant_idx
  on public.payment_provider_accounts (restaurant_id, status);

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
  manually_confirmed_by uuid,
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
  constraint payment_transactions_amount_check check (amount > 0),
  constraint payment_transactions_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_status_check
    check (status in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  constraint payment_transactions_processing_mode_check
    check (processing_mode in ('manual', 'online', 'legacy')),
  constraint payment_transactions_version_check check (version > 0),
  constraint payment_transactions_manual_confirmer_check
    check (
      (provider = 'manual' and manually_confirmed_by is not null)
      or (provider <> 'manual' and manually_confirmed_by is null)
    ),
  constraint payment_transactions_restaurant_id_idempotency_key_key
    unique (restaurant_id, idempotency_key),
  constraint payment_transactions_id_restaurant_id_key
    unique (id, restaurant_id)
);

create unique index payment_transactions_provider_external_payment_id_uidx
  on public.payment_transactions (provider, external_payment_id)
  where external_payment_id is not null;
create unique index payment_transactions_one_active_manual_per_order_idx
  on public.payment_transactions (order_id)
  where provider = 'manual'
    and status in ('created', 'pending', 'processing', 'paid');
create index payment_transactions_order_idx
  on public.payment_transactions (order_id, created_at desc);
create index payment_transactions_restaurant_status_idx
  on public.payment_transactions (restaurant_id, status, created_at desc);

alter table public.orders
  add constraint orders_payment_transaction_tenant_fkey
  foreign key (payment_transaction_id, restaurant_id)
  references public.payment_transactions(id, restaurant_id)
  on delete restrict;

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
  constraint payment_webhook_events_attempts_check check (attempts >= 0),
  constraint payment_webhook_events_account_requires_tenant_check
    check (provider_account_id is null or restaurant_id is not null),
  constraint payment_webhook_events_transaction_requires_tenant_check
    check (payment_transaction_id is null or restaurant_id is not null),
  constraint payment_webhook_events_provider_external_event_id_key
    unique (provider, external_event_id)
);

create index payment_webhook_events_pending_idx
  on public.payment_webhook_events (status, received_at)
  where status in ('received', 'failed');

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
  constraint payment_oauth_states_provider_check check (provider = 'mercado_pago'),
  constraint payment_oauth_states_environment_check
    check (environment in ('sandbox', 'production')),
  constraint payment_oauth_states_expiration_check check (expires_at > created_at),
  constraint payment_oauth_states_consumed_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index payment_oauth_states_expiration_idx
  on public.payment_oauth_states (expires_at)
  where consumed_at is null;

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
  constraint payment_effect_outbox_attempts_check check (attempts >= 0),
  constraint payment_effect_outbox_lease_check
    check (locked_until is null or locked_at is not null),
  constraint payment_effect_outbox_transaction_effect_type_key
    unique (payment_transaction_id, effect_type)
);

create index payment_effect_outbox_available_idx
  on public.payment_effect_outbox (available_at, created_at)
  where status in ('pending', 'failed');
create index payment_effect_outbox_expired_lease_idx
  on public.payment_effect_outbox (locked_until)
  where status = 'processing';

commit;
