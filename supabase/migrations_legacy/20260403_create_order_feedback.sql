create table if not exists public.order_feedback (
  order_id uuid primary key references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  reasons text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists order_feedback_restaurant_created_at_idx
  on public.order_feedback (restaurant_id, created_at desc);

alter table public.order_feedback enable row level security;

-- Donos podem ler o feedback consolidado do próprio restaurante no overview.
drop policy if exists "Owners can read order feedback" on public.order_feedback;
create policy "Owners can read order feedback"
  on public.order_feedback
  for select
  using (
    exists (
      select 1
      from public.restaurants
      where restaurants.id = order_feedback.restaurant_id
        and restaurants.owner_id = auth.uid()
    )
  );

-- O cliente pode enviar feedback sem autenticação, desde que o pedido exista e já esteja entregue.
drop policy if exists "Anyone can insert order feedback" on public.order_feedback;
create policy "Anyone can insert order feedback"
  on public.order_feedback
  for insert
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_feedback.order_id
        and orders.restaurant_id = order_feedback.restaurant_id
        and orders.status = 'delivered'
    )
  );

-- Permitimos atualização por order_id para reenvio idempotente do mesmo pedido.
drop policy if exists "Anyone can update own order feedback by order" on public.order_feedback;
create policy "Anyone can update own order feedback by order"
  on public.order_feedback
  for update
  using (true)
  with check (
    exists (
      select 1
      from public.orders
      where orders.id = order_feedback.order_id
        and orders.restaurant_id = order_feedback.restaurant_id
        and orders.status = 'delivered'
    )
  );
