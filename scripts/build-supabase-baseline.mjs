import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const legacyDir = path.join(root, "supabase", "migrations_legacy");
const outputDir = path.join(root, "supabase", "migrations");

const readLegacy = (name) => readFile(path.join(legacyDir, name), "utf8");
const lines = (sql, start, end) => sql.split(/\r?\n/).slice(start - 1, end).join("\n");
const between = (sql, start, end) => {
  const from = sql.indexOf(start);
  const to = end ? sql.indexOf(end, from) : sql.length;
  if (from < 0 || to < 0) throw new Error(`Unable to find baseline fragment: ${start}`);
  return sql.slice(from, to);
};
const normalize = (sql) => sql
  .replace(/^\s*(?:begin|commit);\s*$/gim, "")
  .replace(/create table if not exists/gi, "create table")
  .replace(/^--.*(?:asaas|n8n).*$/gim, "")
  .replace(/,\s*'asaas_legacy'/gi, "")
  .trim();

const legacy = Object.fromEntries(await Promise.all([
  "20260725091000_add_payment_providers_v2.sql",
  "20260801090000_add_manual_payment_audit.sql",
  "20260801101000_add_payment_effect_processing.sql",
  "20260806090000_add_hosted_checkout_transition.sql",
  "20260808120000_align_public_order_return_types.sql",
  "20260819130000_fix_public_order_v3_status_ambiguity.sql",
  "20260829100000_create_organizations_and_memberships.sql",
  "20260829102000_harden_restaurant_multitenant_access.sql",
  "20260829103000_harden_storage_membership_policies.sql",
  "20260830110000_add_account_preferences_and_staff_subscription_read.sql",
  "20260831211000_add_resumable_onboarding.sql",
  "20260901003000_fix_onboarding_operation_draft_overload.sql",
  "20260901004000_finalize_onboarding_atomic.sql",
  "20260901005000_persist_restaurant_assets.sql",
  "20260902100000_add_restaurant_entitlement_capability.sql",
  "20260911090000_harden_billing_and_membership_boundaries.sql",
].map(async (name) => [name, await readLegacy(name)])));

const baseline = {
  "20260914180000_01_extensions_core_prerequisites.sql": `
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
`,

  "20260914180100_02_organizations_accounts_restaurants.sql": `
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
`,

  "20260914180200_03_menu_orders_operational_schema.sql": `
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
`,

  "20260914180300_04_current_payment_infrastructure.sql": normalize([
    lines(legacy["20260725091000_add_payment_providers_v2.sql"], 1, 290),
    legacy["20260801090000_add_manual_payment_audit.sql"],
  ].join("\n\n")),

  "20260914180400_05_functions_triggers_rpcs.sql": normalize([
    between(
      legacy["20260829102000_harden_restaurant_multitenant_access.sql"],
      "create or replace function public.is_organization_member",
      "drop policy if exists \"organization_members_select_organizations\"",
    ),
    between(
      legacy["20260829100000_create_organizations_and_memberships.sql"],
      "create or replace function public.get_or_create_default_owner_organization",
      "with owner_restaurants as",
    ),
    between(
      legacy["20260829100000_create_organizations_and_memberships.sql"],
      "drop trigger if exists update_organizations_updated_at",
      "alter table public.organizations enable row level security",
    ),
    between(
      legacy["20260830110000_add_account_preferences_and_staff_subscription_read.sql"],
      "create or replace function public.initialize_organization_subscription_trial",
    ),
    between(
      legacy["20260831211000_add_resumable_onboarding.sql"],
      "create or replace function public.sync_restaurant_onboarding_state",
      "create or replace function public.save_onboarding_draft",
    ),
    between(
      legacy["20260831211000_add_resumable_onboarding.sql"],
      "create or replace function public.save_onboarding_draft",
    ),
    legacy["20260901003000_fix_onboarding_operation_draft_overload.sql"],
    legacy["20260901004000_finalize_onboarding_atomic.sql"],
    legacy["20260902100000_add_restaurant_entitlement_capability.sql"],
    legacy["20260808120000_align_public_order_return_types.sql"],
    legacy["20260819130000_fix_public_order_v3_status_ambiguity.sql"],
    legacy["20260806090000_add_hosted_checkout_transition.sql"],
    legacy["20260801101000_add_payment_effect_processing.sql"],
    `
create or replace function public.set_order_display_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  select coalesce(max(display_id), 0) + 1 into new.display_id
  from public.orders
  where restaurant_id = new.restaurant_id;
  return new;
end;
$$;

drop trigger if exists trg_set_order_display_id on public.orders;
create trigger trg_set_order_display_id
before insert on public.orders
for each row execute function public.set_order_display_id();

create or replace function public.is_delivered_order_for_feedback(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_public_access_token text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.orders
    where id = p_order_id
      and restaurant_id = p_restaurant_id
      and status = 'delivered'
      and public_access_token_hash = encode(
        extensions.digest(p_public_access_token, 'sha256'),
        'hex'
      )
  );
$$;

revoke all on function public.is_delivered_order_for_feedback(uuid, uuid, text) from public;

create or replace function public.submit_order_feedback(
  p_order_id uuid,
  p_restaurant_id uuid,
  p_rating integer,
  p_reasons text[],
  p_comment text,
  p_public_access_token text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_public_access_token is null or not exists (
    select 1 from public.orders
    where id = p_order_id
      and restaurant_id = p_restaurant_id
      and public_access_token_hash = encode(
        extensions.digest(p_public_access_token, 'sha256'),
        'hex'
      )
  ) then
    raise exception 'invalid order access' using errcode = '42501';
  end if;

  if not public.is_delivered_order_for_feedback(
    p_order_id, p_restaurant_id, p_public_access_token
  ) then
    raise exception 'order is not delivered' using errcode = '22023';
  end if;

  insert into public.order_feedback (
    order_id, restaurant_id, rating, reasons, comment
  ) values (
    p_order_id, p_restaurant_id, p_rating, coalesce(p_reasons, '{}'), p_comment
  );
exception
  when unique_violation then
    raise exception 'feedback already submitted' using errcode = '23505';
end;
$$;

revoke all on function public.submit_order_feedback(uuid, uuid, integer, text[], text, text)
  from public;
grant execute on function public.submit_order_feedback(uuid, uuid, integer, text[], text, text)
  to anon, authenticated;
`,
  ].join("\n\n")),

  "20260914180500_06_rls_grants_views.sql": normalize([
    `
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.restaurants enable row level security;
alter table public.account_preferences enable row level security;
alter table public.restaurant_activation_progress enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_item_variations enable row level security;
alter table public.table_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_feedback enable row level security;
alter table public.push_subscriptions enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
`,
    between(
      legacy["20260829102000_harden_restaurant_multitenant_access.sql"],
      "drop policy if exists \"organization_members_select_organizations\"",
    ),
    between(
      legacy["20260830110000_add_account_preferences_and_staff_subscription_read.sql"],
      "alter table public.account_preferences enable row level security",
      "drop policy if exists \"organization_members_read_subscriptions\"",
    ),
    between(
      legacy["20260911090000_harden_billing_and_membership_boundaries.sql"],
      "create or replace function public.guard_restaurant_membership_boundaries",
      "alter table public.organization_subscriptions enable row level security",
    ),
    `
revoke all privileges on table public.organization_subscriptions from public, anon, authenticated;
drop policy if exists "organization_members_read_subscriptions" on public.organization_subscriptions;
create policy "organization_members_read_subscriptions"
on public.organization_subscriptions for select to authenticated
using (public.is_organization_member(organization_id));
grant select (organization_id, plan_type, plan_status, trial_ends_at)
  on public.organization_subscriptions to authenticated;

grant select, insert, update on public.account_preferences to authenticated;

grant select on public.organizations, public.organization_members to authenticated;

grant select on public.restaurants to authenticated;
grant insert, update on public.restaurants to authenticated;

grant select on public.menu_items, public.menu_item_variations to anon, authenticated;
grant insert, update, delete on public.menu_items, public.menu_item_variations to authenticated;

create policy public_read_menu_items on public.menu_items for select to anon, authenticated using (true);
create policy members_manage_menu_items on public.menu_items for all to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));
create policy public_read_menu_item_variations on public.menu_item_variations for select to anon, authenticated using (true);
create policy members_manage_menu_item_variations on public.menu_item_variations for all to authenticated
  using (exists (
    select 1 from public.menu_items item
    where item.id = menu_item_id and public.is_restaurant_member(item.restaurant_id)
  ))
  with check (exists (
    select 1 from public.menu_items item
    where item.id = menu_item_id and public.is_restaurant_member(item.restaurant_id)
  ));

grant select on public.table_sessions, public.orders, public.order_items to authenticated;
grant insert, update, delete on public.table_sessions to authenticated;
grant update (status, updated_at, table_number) on public.orders to authenticated;
create policy members_manage_table_sessions on public.table_sessions for all to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));
create policy members_manage_orders on public.orders for all to authenticated
  using (public.is_restaurant_member(restaurant_id))
  with check (public.is_restaurant_member(restaurant_id));
create policy members_manage_order_items on public.order_items for all to authenticated
  using (exists (
    select 1 from public.orders order_row
    where order_row.id = order_id and public.is_restaurant_member(order_row.restaurant_id)
  ))
  with check (exists (
    select 1 from public.orders order_row
    where order_row.id = order_id and public.is_restaurant_member(order_row.restaurant_id)
  ));

grant select on public.order_feedback to authenticated;
create policy members_read_order_feedback on public.order_feedback for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

grant select on public.push_subscriptions to authenticated;
create policy members_read_push_subscriptions on public.push_subscriptions for select to authenticated
  using (public.is_restaurant_member(restaurant_id));

grant select, insert on public.restaurant_activation_progress to authenticated;
create policy restaurant_members_read_activation_progress
  on public.restaurant_activation_progress for select to authenticated
  using (public.is_restaurant_member(restaurant_id));
create policy restaurant_members_insert_activation_progress
  on public.restaurant_activation_progress for insert to authenticated
  with check (public.is_restaurant_member(restaurant_id) and completed_by = auth.uid());

revoke select, insert, update, delete on public.orders, public.order_items from anon;
revoke all on public.organization_subscriptions from anon;
`,
  ].join("\n\n")),

  "20260914180600_07_storage_realtime.sql": normalize([
    `
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images', 'menu-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
`,
    legacy["20260829103000_harden_storage_membership_policies.sql"],
    legacy["20260901005000_persist_restaurant_assets.sql"],
    `
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;

notify pgrst, 'reload schema';
`,
  ].join("\n\n")),
};

await mkdir(outputDir, { recursive: true });
for (const [name, sql] of Object.entries(baseline)) {
  await writeFile(path.join(outputDir, name), `${normalize(sql)}\n`, "utf8");
}

console.log(`Generated ${Object.keys(baseline).length} Supabase baseline migrations.`);
