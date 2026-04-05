alter table public.restaurants
  add column if not exists asaas_setup_status text,
  add column if not exists asaas_webhook_id text,
  add column if not exists asaas_webhook_url text,
  add column if not exists asaas_webhook_token text,
  add column if not exists asaas_last_validated_at timestamptz,
  add column if not exists asaas_last_error text,
  add column if not exists billing_last_error text,
  add column if not exists subscription_canceled_at timestamptz;

alter table public.orders
  add column if not exists payment_confirmed_at timestamptz;

create table if not exists public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists payment_provider_events_provider_event_uidx
  on public.payment_provider_events (provider, provider_event_id);

create table if not exists public.billing_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  stripe_customer_id text,
  stripe_subscription_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists billing_provider_events_provider_event_uidx
  on public.billing_provider_events (provider, provider_event_id);

alter table public.payment_provider_events enable row level security;
alter table public.billing_provider_events enable row level security;

create policy "owners_can_read_payment_provider_events"
on public.payment_provider_events
for select
to authenticated
using (
  restaurant_id is not null and exists (
    select 1
    from public.restaurants r
    where r.id = payment_provider_events.restaurant_id
      and r.owner_id = auth.uid()
  )
);

create policy "owners_can_read_billing_provider_events"
on public.billing_provider_events
for select
to authenticated
using (
  restaurant_id is not null and exists (
    select 1
    from public.restaurants r
    where r.id = billing_provider_events.restaurant_id
      and r.owner_id = auth.uid()
  )
);
