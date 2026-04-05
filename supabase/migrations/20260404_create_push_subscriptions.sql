create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  origin text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_uidx
  on public.push_subscriptions (endpoint);

alter table public.push_subscriptions enable row level security;

create policy "owners_can_read_push_subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = push_subscriptions.restaurant_id
      and r.owner_id = auth.uid()
  )
);
