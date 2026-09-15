alter table public.table_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'table_sessions'
      and policyname = 'public_read_open_sessions'
  ) then
    create policy "public_read_open_sessions"
    on public.table_sessions
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'table_sessions'
      and policyname = 'public_insert_sessions'
  ) then
    create policy "public_insert_sessions"
    on public.table_sessions
    for insert
    to anon, authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'table_sessions'
      and policyname = 'public_update_sessions'
  ) then
    create policy "public_update_sessions"
    on public.table_sessions
    for update
    to anon, authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'public_read_orders'
  ) then
    create policy "public_read_orders"
    on public.orders
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'public_insert_orders'
  ) then
    create policy "public_insert_orders"
    on public.orders
    for insert
    to anon, authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'public_read_order_items'
  ) then
    create policy "public_read_order_items"
    on public.order_items
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_items'
      and policyname = 'public_insert_order_items'
  ) then
    create policy "public_insert_order_items"
    on public.order_items
    for insert
    to anon, authenticated
    with check (true);
  end if;
end $$;

create or replace function public.set_order_display_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(max(display_id), 0) + 1
    into new.display_id
  from public.orders
  where restaurant_id = new.restaurant_id;

  return new;
end;
$$;
