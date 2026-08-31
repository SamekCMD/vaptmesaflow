create table if not exists public.organization_subscription_backfill_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reason text not null,
  details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_type text not null default 'starter',
  plan_status text not null default 'trialing',
  trial_ends_at timestamptz,
  asaas_billing_document text,
  asaas_environment text not null default 'production',
  asaas_setup_status text,
  asaas_webhook_id text,
  asaas_webhook_url text,
  asaas_webhook_token text,
  asaas_last_validated_at timestamptz,
  asaas_last_error text,
  subscription_canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_asaas_environment_check
    check (asaas_environment in ('production', 'sandbox'))
);

with distinct_profiles as (
  select distinct
    restaurant.organization_id,
    restaurant.plan_type,
    restaurant.plan_status,
    restaurant.trial_ends_at,
    restaurant.asaas_billing_document,
    restaurant.asaas_environment,
    restaurant.asaas_setup_status,
    restaurant.asaas_webhook_id,
    restaurant.asaas_webhook_url,
    restaurant.asaas_webhook_token,
    restaurant.asaas_last_validated_at,
    restaurant.asaas_last_error,
    restaurant.subscription_canceled_at
  from public.restaurants as restaurant
),
conflicting_profiles as (
  select
    profile.organization_id,
    jsonb_agg(
      jsonb_build_object(
        'plan_type', profile.plan_type,
        'plan_status', profile.plan_status,
        'trial_ends_at', profile.trial_ends_at,
        'asaas_billing_document', profile.asaas_billing_document,
        'asaas_environment', profile.asaas_environment,
        'asaas_setup_status', profile.asaas_setup_status,
        'asaas_webhook_id', profile.asaas_webhook_id,
        'asaas_webhook_url', profile.asaas_webhook_url,
        'asaas_webhook_token', profile.asaas_webhook_token,
        'asaas_last_validated_at', profile.asaas_last_validated_at,
        'asaas_last_error', profile.asaas_last_error,
        'subscription_canceled_at', profile.subscription_canceled_at
      )
      order by profile.plan_status, profile.trial_ends_at desc nulls last
    ) as details
  from distinct_profiles as profile
  group by profile.organization_id
  having count(*) > 1
)
insert into public.organization_subscription_backfill_conflicts (
  organization_id,
  reason,
  details
)
select
  conflicting_profiles.organization_id,
  'multiple_legacy_subscription_profiles',
  conflicting_profiles.details
from conflicting_profiles
where not exists (
  select 1
  from public.organization_subscription_backfill_conflicts as conflict
  where conflict.organization_id = conflicting_profiles.organization_id
    and conflict.reason = 'multiple_legacy_subscription_profiles'
);

with ranked_restaurants as (
  select
    restaurant.*,
    row_number() over (
      partition by restaurant.organization_id
      order by
        case lower(coalesce(restaurant.plan_status, ''))
          when 'active' then 3
          when 'trialing' then 2
          else 1
        end desc,
        restaurant.trial_ends_at desc nulls last,
        restaurant.updated_at desc nulls last,
        restaurant.created_at asc
    ) as priority_rank
  from public.restaurants as restaurant
)
insert into public.organization_subscriptions (
  organization_id,
  plan_type,
  plan_status,
  trial_ends_at,
  asaas_billing_document,
  asaas_environment,
  asaas_setup_status,
  asaas_webhook_id,
  asaas_webhook_url,
  asaas_webhook_token,
  asaas_last_validated_at,
  asaas_last_error,
  subscription_canceled_at,
  created_at,
  updated_at
)
select
  ranked_restaurants.organization_id,
  ranked_restaurants.plan_type,
  ranked_restaurants.plan_status,
  ranked_restaurants.trial_ends_at,
  ranked_restaurants.asaas_billing_document,
  ranked_restaurants.asaas_environment,
  ranked_restaurants.asaas_setup_status,
  ranked_restaurants.asaas_webhook_id,
  ranked_restaurants.asaas_webhook_url,
  ranked_restaurants.asaas_webhook_token,
  ranked_restaurants.asaas_last_validated_at,
  ranked_restaurants.asaas_last_error,
  ranked_restaurants.subscription_canceled_at,
  ranked_restaurants.created_at,
  now()
from ranked_restaurants
where ranked_restaurants.priority_rank = 1
on conflict (organization_id) do update
  set plan_type = excluded.plan_type,
      plan_status = excluded.plan_status,
      trial_ends_at = excluded.trial_ends_at,
      asaas_billing_document = excluded.asaas_billing_document,
      asaas_environment = excluded.asaas_environment,
      asaas_setup_status = excluded.asaas_setup_status,
      asaas_webhook_id = excluded.asaas_webhook_id,
      asaas_webhook_url = excluded.asaas_webhook_url,
      asaas_webhook_token = excluded.asaas_webhook_token,
      asaas_last_validated_at = excluded.asaas_last_validated_at,
      asaas_last_error = excluded.asaas_last_error,
      subscription_canceled_at = excluded.subscription_canceled_at,
      updated_at = now();

create or replace function public.get_plan_max_restaurants(p_plan_type text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_plan_type, 'starter'))
    when 'starter' then 1
    when 'trial' then 1
    when 'trialing' then 1
    when 'growth' then 3
    when 'pro' then 3
    when 'scale' then 25
    when 'enterprise' then 25
    else 1
  end;
$$;

create or replace function public.enforce_restaurant_entitlement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan_type text;
  v_max_restaurants integer;
  v_restaurant_count integer;
begin
  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;

  select subscription.plan_type
    into v_plan_type
  from public.organization_subscriptions as subscription
  where subscription.organization_id = new.organization_id;

  v_max_restaurants := public.get_plan_max_restaurants(coalesce(v_plan_type, new.plan_type));

  select count(*)
    into v_restaurant_count
  from public.restaurants as restaurant
  where restaurant.organization_id = new.organization_id
    and restaurant.id is distinct from new.id;

  if v_restaurant_count >= v_max_restaurants then
    raise exception 'organization restaurant limit reached'
      using errcode = 'P0001',
            detail = format(
              'Organization %s already uses %s of %s restaurants.',
              new.organization_id,
              v_restaurant_count,
              v_max_restaurants
            );
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_restaurant_entitlement on public.restaurants;
create trigger enforce_restaurant_entitlement
before insert or update of organization_id
on public.restaurants
for each row
execute function public.enforce_restaurant_entitlement();

drop trigger if exists update_organization_subscriptions_updated_at on public.organization_subscriptions;
create trigger update_organization_subscriptions_updated_at
before update on public.organization_subscriptions
for each row
execute function public.update_updated_at_column();

alter table public.organization_subscriptions enable row level security;
