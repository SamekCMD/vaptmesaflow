begin;

-- Permissive policies combine with OR: legacy ownership must not survive a
-- disabled/deleted organization membership.
drop policy if exists owners_select_own on public.restaurants;
drop policy if exists owners_update_own on public.restaurants;
drop policy if exists owners_insert_own on public.restaurants;

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

alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscription_backfill_conflicts enable row level security;

-- Replace the complete policy surface, including any older deployment policies.
-- The service_role bypasses RLS; conflict records intentionally have no policies.
do $$
declare
  policy_record record;
  column_record record;
begin
  for policy_record in
    select tablename, policyname from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in ('organization_subscriptions', 'organization_subscription_backfill_conflicts')
  loop
    execute format('drop policy %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;

  -- Table REVOKE does not remove independent column ACLs. Enumerate every
  -- existing column so old secret-field grants cannot survive this migration.
  for column_record in
    select c.relname, a.attname
    from pg_catalog.pg_attribute as a
    join pg_catalog.pg_class as c on c.oid = a.attrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('organization_subscriptions', 'organization_subscription_backfill_conflicts')
      and a.attnum > 0 and not a.attisdropped
  loop
    execute format(
      'revoke all privileges (%I) on table public.%I from public, anon, authenticated',
      column_record.attname, column_record.relname
    );
  end loop;
end;
$$;

revoke all privileges on table public.organization_subscriptions,
  public.organization_subscription_backfill_conflicts from public, anon, authenticated;

create policy organization_members_read_subscriptions
on public.organization_subscriptions
for select to authenticated
using (public.is_organization_member(organization_id));

-- Exact projection consumed by src/hooks/useSubscription.ts. New columns are
-- private by default; wildcard reads must fail rather than expose billing data.
grant select (organization_id, plan_type, plan_status, trial_ends_at)
  on public.organization_subscriptions to authenticated;
grant all privileges on table public.organization_subscriptions,
  public.organization_subscription_backfill_conflicts to service_role;

notify pgrst, 'reload schema';
commit;
