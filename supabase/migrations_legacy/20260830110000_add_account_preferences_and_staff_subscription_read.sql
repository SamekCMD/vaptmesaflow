create table if not exists public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_organization_id uuid references public.organizations(id) on delete set null,
  current_restaurant_id uuid references public.restaurants(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.account_preferences is
  'Server-side current organization and restaurant selection for deterministic account bootstrap.';

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

drop policy if exists "organization_members_read_subscriptions" on public.organization_subscriptions;
create policy "organization_members_read_subscriptions"
on public.organization_subscriptions
for select
to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.initialize_organization_subscription_trial()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not coalesce(new.onboarding_completed, false) then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and coalesce(old.onboarding_completed, false)
    and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  insert into public.organization_subscriptions as subscription (
    organization_id,
    plan_type,
    plan_status,
    trial_ends_at
  )
  values (
    new.organization_id,
    'starter',
    'trialing',
    now() + interval '3 days'
  )
  on conflict (organization_id) do update
    set trial_ends_at = coalesce(subscription.trial_ends_at, excluded.trial_ends_at),
        updated_at = now()
    where subscription.plan_status = 'trialing';

  return new;
end;
$$;

revoke all on function public.initialize_organization_subscription_trial() from public;

drop trigger if exists initialize_organization_subscription_trial on public.restaurants;
create trigger initialize_organization_subscription_trial
after insert or update of onboarding_completed, organization_id on public.restaurants
for each row
execute function public.initialize_organization_subscription_trial();
