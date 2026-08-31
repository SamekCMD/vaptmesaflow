create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint organization_members_role_check
    check (role in ('owner', 'admin', 'manager', 'staff')),
  constraint organization_members_status_check
    check (status in ('active', 'invited', 'disabled'))
);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);

alter table public.restaurants
  add column if not exists organization_id uuid;

create or replace function public.get_or_create_default_owner_organization(
  p_owner_id uuid,
  p_restaurant_name text default null,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_organization_id uuid;
  v_organization_name text;
begin
  select member.organization_id
    into v_organization_id
  from public.organization_members as member
  where member.user_id = p_owner_id
    and member.role = 'owner'
    and member.status = 'active'
  order by member.created_at
  limit 1;

  if v_organization_id is not null then
    return v_organization_id;
  end if;

  v_organization_name := coalesce(
    nullif(btrim(p_restaurant_name), ''),
    'Workspace ' || left(p_owner_id::text, 8)
  );

  insert into public.organizations (name, created_by, created_at, updated_at)
  values (v_organization_name, p_owner_id, coalesce(p_created_at, now()), now())
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    created_at,
    updated_at
  )
  values (
    v_organization_id,
    p_owner_id,
    'owner',
    'active',
    coalesce(p_created_at, now()),
    now()
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        updated_at = now();

  return v_organization_id;
end;
$$;

create or replace function public.assign_restaurant_organization_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.organization_id is null and new.owner_id is not null then
    new.organization_id := public.get_or_create_default_owner_organization(
      new.owner_id,
      new.name,
      coalesce(new.created_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_restaurant_organization_id on public.restaurants;
create trigger ensure_restaurant_organization_id
before insert or update of owner_id, organization_id, name
on public.restaurants
for each row
execute function public.assign_restaurant_organization_id();

with owner_restaurants as (
  select
    restaurant.owner_id,
    min(restaurant.created_at) as created_at,
    coalesce(
      max(restaurant.name) filter (where nullif(btrim(restaurant.name), '') is not null),
      'Workspace ' || left(restaurant.owner_id::text, 8)
    ) as organization_name
  from public.restaurants as restaurant
  group by restaurant.owner_id
)
insert into public.organizations (name, created_by, created_at, updated_at)
select
  owner_restaurants.organization_name,
  owner_restaurants.owner_id,
  owner_restaurants.created_at,
  now()
from owner_restaurants
where not exists (
  select 1
  from public.organization_members as member
  where member.user_id = owner_restaurants.owner_id
    and member.role = 'owner'
    and member.status = 'active'
);

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  created_at,
  updated_at
)
select
  organization.id,
  organization.created_by,
  'owner',
  'active',
  organization.created_at,
  now()
from public.organizations as organization
where not exists (
  select 1
  from public.organization_members as member
  where member.organization_id = organization.id
    and member.user_id = organization.created_by
);

update public.restaurants as restaurant
set organization_id = member.organization_id
from public.organization_members as member
where restaurant.organization_id is null
  and member.user_id = restaurant.owner_id
  and member.role = 'owner'
  and member.status = 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_organization_id_fkey'
      and conrelid = 'public.restaurants'::regclass
  ) then
    alter table public.restaurants
      add constraint restaurants_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete restrict;
  end if;
end;
$$;

alter table public.restaurants
  alter column organization_id set not null;

create index if not exists restaurants_organization_id_idx
  on public.restaurants (organization_id);

comment on column public.restaurants.owner_id is
  'Deprecated compatibility column. Authorization should migrate to organization membership.';

drop trigger if exists update_organizations_updated_at on public.organizations;
create trigger update_organizations_updated_at
before update on public.organizations
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_organization_members_updated_at on public.organization_members;
create trigger update_organization_members_updated_at
before update on public.organization_members
for each row
execute function public.update_updated_at_column();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
