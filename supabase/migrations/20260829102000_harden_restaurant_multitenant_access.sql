create or replace function public.is_organization_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = p_user_id
      and member.status = 'active'
  );
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = p_organization_id
      and member.user_id = p_user_id
      and member.status = 'active'
      and member.role = any (p_roles)
  );
$$;

create or replace function public.is_restaurant_member(
  p_restaurant_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.restaurants as restaurant
    where restaurant.id = p_restaurant_id
      and public.is_organization_member(restaurant.organization_id, p_user_id)
  );
$$;

create or replace view public.restaurant_public_profiles as
select
  restaurant.id,
  restaurant.organization_id,
  restaurant.slug,
  restaurant.name,
  restaurant.logo_url,
  restaurant.primary_color,
  restaurant.secondary_color,
  restaurant.font_family,
  restaurant.payment_mode,
  restaurant.max_pending_orders,
  restaurant.phone,
  restaurant.whatsapp,
  restaurant.local_enabled,
  restaurant.delivery_enabled
from public.restaurants as restaurant;

revoke all on table public.restaurant_public_profiles from public;

create or replace function public.get_public_restaurant_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  font_family text,
  payment_mode text,
  max_pending_orders integer,
  local_enabled boolean,
  delivery_enabled boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    profile.id,
    profile.name,
    profile.slug,
    profile.logo_url,
    profile.primary_color,
    profile.secondary_color,
    profile.font_family,
    profile.payment_mode,
    profile.max_pending_orders,
    profile.local_enabled,
    profile.delivery_enabled
  from public.restaurant_public_profiles as profile
  where profile.slug = p_slug
  limit 1;
$$;

revoke all on function public.get_public_restaurant_by_slug(text) from public;
grant execute on function public.get_public_restaurant_by_slug(text) to anon, authenticated, service_role;

drop policy if exists "organization_members_select_organizations" on public.organizations;
create policy "organization_members_select_organizations"
on public.organizations
for select
to authenticated
using (public.is_organization_member(id));

drop policy if exists "owners_insert_organizations" on public.organizations;
create policy "owners_insert_organizations"
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "organization_members_select_memberships" on public.organization_members;
create policy "organization_members_select_memberships"
on public.organization_members
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists "organization_members_select_restaurants" on public.restaurants;
create policy "organization_members_select_restaurants"
on public.restaurants
for select
to authenticated
using (public.is_restaurant_member(id));

drop policy if exists "organization_members_update_restaurants" on public.restaurants;
create policy "organization_members_update_restaurants"
on public.restaurants
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'manager']
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'manager']
  )
);

drop policy if exists "organization_members_insert_restaurants" on public.restaurants;
create policy "organization_members_insert_restaurants"
on public.restaurants
for insert
to authenticated
with check (
  organization_id is not null
  and public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);

drop policy if exists "organization_members_read_subscriptions" on public.organization_subscriptions;
create policy "organization_members_read_subscriptions"
on public.organization_subscriptions
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin', 'manager']
  )
);

drop policy if exists "organization_members_update_subscriptions" on public.organization_subscriptions;
create policy "organization_members_update_subscriptions"
on public.organization_subscriptions
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'admin']
  )
);
