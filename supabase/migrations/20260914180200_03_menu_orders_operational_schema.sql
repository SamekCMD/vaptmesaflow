create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
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
  updated_at timestamptz not null default now()
);

create index menu_items_restaurant_id_idx on public.menu_items (restaurant_id);

create table public.menu_item_variations (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  options text[] not null default '{}',
  required boolean not null default false,
  created_at timestamptz not null default now()
);

create index menu_item_variations_menu_item_id_idx on public.menu_item_variations (menu_item_id);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number text not null,
  status text not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index table_sessions_restaurant_id_idx on public.table_sessions (restaurant_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_session_id uuid references public.table_sessions(id) on delete set null,
  table_number text,
  display_id integer,
  total_price numeric(10,2) not null default 0 check (total_price >= 0),
  status text not null default 'pending',
  payment_status text,
  payment_confirmed_at timestamptz,
  order_channel text not null default 'local' check (order_channel in ('local', 'delivery')),
  public_access_token_hash text,
  creation_idempotency_key text,
  creation_request_fingerprint text,
  delivery_customer_name text,
  delivery_phone text,
  delivery_street text,
  delivery_number text,
  delivery_neighborhood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_restaurant_idempotency_key_idx
  on public.orders (restaurant_id, creation_idempotency_key)
  where creation_idempotency_key is not null;
create index orders_public_access_token_idx
  on public.orders (id, public_access_token_hash)
  where public_access_token_hash is not null;
create index orders_restaurant_created_at_idx on public.orders (restaurant_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  notes text default '',
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

create table public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  reasons text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
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
