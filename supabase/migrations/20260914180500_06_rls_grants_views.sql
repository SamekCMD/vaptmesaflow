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


alter table public.account_preferences enable row level security;

revoke all on public.account_preferences from anon;
grant select, insert, update on public.account_preferences to authenticated;

drop policy if exists "users_read_own_account_preferences" on public.account_preferences;
create policy "users_read_own_account_preferences"
on public.account_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users_insert_own_account_preferences" on public.account_preferences;
create policy "users_insert_own_account_preferences"
on public.account_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users_update_own_account_preferences" on public.account_preferences;
create policy "users_update_own_account_preferences"
on public.account_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists update_account_preferences_updated_at on public.account_preferences;
create trigger update_account_preferences_updated_at
before update on public.account_preferences
for each row
execute function public.update_updated_at_column();



create or replace function public.guard_restaurant_membership_boundaries()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- Use the effective SQL role, not JWT claims/session_user. Trusted definer
  -- onboarding executes as its owner even when called by an authenticated user.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then
      if new.owner_id is distinct from old.owner_id
        or new.organization_id is distinct from old.organization_id then
        raise exception 'restaurant ownership and organization are backend-managed'
          using errcode = '42501';
      end if;
    elsif new.owner_id is distinct from auth.uid()
      or new.owner_id is null
      or new.organization_id is null
      or not public.has_organization_role(new.organization_id, array['owner', 'admin']) then
      -- Direct inserts may use an existing authorized organization only. First
      -- organization creation remains the responsibility of definer onboarding.
      raise exception 'restaurant ownership and organization are backend-managed'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_restaurant_membership_boundaries()
  from public, anon, authenticated;

-- BEFORE triggers run by name. Check the original values before the definer
-- ensure_restaurant_organization_id trigger can replace a NULL organization.
drop trigger if exists a_guard_restaurant_membership_boundaries on public.restaurants;
create trigger a_guard_restaurant_membership_boundaries
before insert or update on public.restaurants
for each row execute function public.guard_restaurant_membership_boundaries();




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
