create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'staff')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_organization_id_idx on public.organization_members (organization_id);

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_type text not null default 'starter',
  plan_status text not null default 'trialing',
  trial_ends_at timestamptz,
  subscription_canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
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
  total_tables integer not null default 1 check (total_tables > 0),
  max_tables integer not null default 1 check (max_tables > 0),
  payment_mode text not null default 'open_tab' check (payment_mode in ('open_tab', 'prepaid')),
  max_pending_orders integer not null default 3 check (max_pending_orders between 1 and 10),
  local_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft', 'complete')),
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 3),
  onboarding_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index restaurants_organization_id_idx on public.restaurants (organization_id);
comment on column public.restaurants.owner_id is
  'Deprecated compatibility column. Authorization uses organization membership.';

create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_organization_id uuid references public.organizations(id) on delete set null,
  current_restaurant_id uuid references public.restaurants(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.restaurant_activation_progress (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  module_key text not null check (module_key in ('cashier', 'menu', 'kitchen', 'settings', 'overview')),
  completed_at timestamptz not null default now(),
  completed_by uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (restaurant_id, module_key)
);

create index restaurant_activation_progress_completed_by_idx
  on public.restaurant_activation_progress (completed_by);
