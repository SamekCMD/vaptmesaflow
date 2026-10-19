-- Local rehearsal first. Requires a coordinated compatible API/consumer rollout.
-- No role, credential, job, public route, resource or trial is provisioned here.
begin;

do $guard$
begin
  if current_database() <> 'vapt' then
    raise exception 'tenant foundation: expected database vapt';
  end if;
  if to_regclass('public.catalog_publication_operations') is null
    or to_regclass('better_auth.session') is null then
    raise exception 'tenant foundation: schema001-009 required';
  end if;
  if exists (select 1 from public.restaurants r
    left join better_auth."user" u on u.id = r.owner_id where u.id is null) then
    raise exception 'tenant foundation: orphan restaurant owner; reconcile before retry';
  end if;
  if exists (select 1 from public.restaurants where plan_type not in ('starter','pro','business')) then
    raise exception 'tenant foundation: invalid legacy plan';
  end if;
  if exists (
    select owner_id from public.restaurants group by owner_id
    having count(distinct jsonb_build_array(plan_type,plan_status,trial_ends_at,
      stripe_customer_id,stripe_subscription_id,stripe_subscription_item_id,stripe_current_period_end,
      stripe_cancel_at_period_end,stripe_state_updated_at,stripe_checkout_session_id,
      stripe_checkout_plan_type,stripe_checkout_expires_at,billing_last_error,subscription_canceled_at)) > 1
  ) then
    raise exception 'tenant foundation: conflicting owner billing; reconcile before retry';
  end if;
  if exists (
    select resource from (
      select owner_id, 'customer:' || stripe_customer_id as resource from public.restaurants where stripe_customer_id is not null
      union all select owner_id, 'subscription:' || stripe_subscription_id from public.restaurants where stripe_subscription_id is not null
      union all select owner_id, 'checkout:' || stripe_checkout_session_id from public.restaurants where stripe_checkout_session_id is not null
    ) resources group by resource having count(distinct owner_id) > 1
  ) then
    raise exception 'tenant foundation: Stripe resource belongs to multiple owners';
  end if;
  if exists (
    select owner_id from public.restaurants group by owner_id
      having count(*) > min(case when plan_status = 'trialing' then 1 when plan_type = 'business' then 25 else 1 end)
  ) then
    raise exception 'tenant foundation: legacy restaurant count exceeds entitlement';
  end if;
end
$guard$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_by uuid not null references better_auth."user"(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references better_auth."user"(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','staff')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members (user_id,organization_id) where status = 'active';

create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_contact_user_id uuid not null references better_auth."user"(id),
  plan_type text not null default 'starter' check (plan_type in ('starter','pro','business')),
  plan_status text not null default 'trialing' check (plan_status in
    ('trialing','active','past_due','incomplete','unpaid','paused','expired','cancelled')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_subscription_item_id text,
  stripe_current_period_end timestamptz,
  stripe_cancel_at_period_end boolean not null default false,
  stripe_state_updated_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_checkout_plan_type text,
  stripe_checkout_expires_at timestamptz,
  billing_last_error text,
  subscription_canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscription_trial_check check
    (trial_started_at is null or (trial_ends_at is not null and trial_ends_at > trial_started_at)),
  constraint organization_subscription_checkout_check check (
    (stripe_checkout_session_id is null and stripe_checkout_plan_type is null and stripe_checkout_expires_at is null)
    or (stripe_checkout_session_id is not null and stripe_checkout_plan_type in ('starter','pro','business')
      and stripe_checkout_plan_type is not null and stripe_checkout_expires_at is not null)
  )
);

alter table public.restaurants
  add column organization_id uuid references public.organizations(id),
  add column onboarding_status text not null default 'draft' check (onboarding_status in ('draft','complete')),
  add column onboarding_step smallint not null default 0 check (onboarding_step between 0 and 2),
  add column onboarding_updated_at timestamptz not null default now(),
  add constraint restaurants_owner_identity_fkey foreign key (owner_id) references better_auth."user"(id);

-- A temporary mapping is used only inside this transaction; all existing IDs survive.
create temporary table tenant_owner_backfill on commit drop as
  select owner_id, gen_random_uuid() as organization_id from public.restaurants group by owner_id;
insert into public.organizations (id,name,created_by,created_at,updated_at)
  select distinct on (r.owner_id) m.organization_id, r.name, r.owner_id, r.created_at, r.updated_at
    from public.restaurants r join tenant_owner_backfill m using (owner_id)
    order by r.owner_id,r.created_at,r.id;
insert into public.organization_members (organization_id,user_id,role,status)
  select organization_id,owner_id,'owner','active' from tenant_owner_backfill;
insert into public.organization_subscriptions (
  organization_id,billing_contact_user_id,plan_type,plan_status,trial_started_at,trial_ends_at,
  stripe_customer_id,stripe_subscription_id,stripe_subscription_item_id,stripe_current_period_end,
  stripe_cancel_at_period_end,stripe_state_updated_at,stripe_checkout_session_id,stripe_checkout_plan_type,
  stripe_checkout_expires_at,billing_last_error,subscription_canceled_at,created_at,updated_at)
  select distinct on (r.owner_id) m.organization_id,r.owner_id,r.plan_type,r.plan_status,
    case when r.trial_ends_at is not null then r.trial_ends_at - interval '3 days' end,r.trial_ends_at,
    r.stripe_customer_id,r.stripe_subscription_id,r.stripe_subscription_item_id,r.stripe_current_period_end,
    r.stripe_cancel_at_period_end,r.stripe_state_updated_at,r.stripe_checkout_session_id,r.stripe_checkout_plan_type,
    r.stripe_checkout_expires_at,r.billing_last_error,r.subscription_canceled_at,r.created_at,r.updated_at
    from public.restaurants r join tenant_owner_backfill m using (owner_id)
    order by r.owner_id,r.created_at,r.id;
update public.restaurants r set organization_id = m.organization_id,
  onboarding_status = case when r.onboarding_completed then 'complete' else 'draft' end,
  onboarding_step = case when r.onboarding_completed then 2 else 0 end,
  onboarding_updated_at = coalesce(r.onboarding_completed_at,r.updated_at)
  from tenant_owner_backfill m where r.owner_id = m.owner_id;
alter table public.restaurants
  alter column organization_id set not null,
  add constraint restaurants_identity_organization_key unique (id,organization_id),
  add constraint restaurants_onboarding_state_check check
    ((onboarding_status = 'complete') = onboarding_completed and (onboarding_status <> 'complete' or onboarding_step = 2));
create index restaurants_organization_idx on public.restaurants (organization_id,created_at,id);

create table public.account_preferences (
  user_id uuid primary key references better_auth."user"(id) on delete cascade,
  organization_id uuid,
  restaurant_id uuid,
  updated_at timestamptz not null default now(),
  constraint account_preferences_selection_check check ((organization_id is null) = (restaurant_id is null)),
  constraint account_preferences_restaurant_fkey foreign key (restaurant_id,organization_id)
    references public.restaurants(id,organization_id) on delete cascade
);
create table public.restaurant_activation_progress (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  module text not null check (module in ('cashier','menu','kitchen','settings','overview')),
  completed_at timestamptz not null default now(),
  completed_by uuid not null references better_auth."user"(id),
  primary key (restaurant_id,module)
);
create table public.onboarding_intents (
  operation_id uuid primary key,
  actor_id uuid not null references better_auth."user"(id),
  organization_id uuid not null references public.organizations(id),
  restaurant_id uuid not null references public.restaurants(id),
  kind text not null check (kind in ('initial_draft','organization_draft','finalize')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  constraint onboarding_intents_restaurant_fkey foreign key (restaurant_id,organization_id)
    references public.restaurants(id,organization_id)
);
create index onboarding_intents_actor_idx on public.onboarding_intents (actor_id,created_at);

create function public.enforce_organization_restaurant_limit() returns trigger
language plpgsql set search_path = pg_catalog,public as $function$
declare restaurant_limit integer; restaurant_count integer;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception using errcode = '23514', constraint = 'restaurant_organization_immutable',
        message = 'Restaurant organization cannot be changed';
    end if;
    return new;
  end if;
  -- Shared contract with tenancy/locks.ts: entitlement changes and creates take exclusive.
  perform pg_advisory_xact_lock(hashtextextended('tenant:organization:' || new.organization_id::text,0));
  select case when plan_status = 'trialing' then 1 when plan_type = 'business' then 25 else 1 end
    into restaurant_limit from public.organization_subscriptions where organization_id = new.organization_id;
  if restaurant_limit is null then
    raise exception using errcode = '23514', constraint = 'organization_restaurant_limit', message = 'Organization entitlement is unavailable';
  end if;
  select count(*) into restaurant_count from public.restaurants where organization_id = new.organization_id;
  if restaurant_count >= restaurant_limit then
    raise exception using errcode = '23514', constraint = 'organization_restaurant_limit', message = 'Organization restaurant limit reached';
  end if;
  return new;
end
$function$;
revoke all on function public.enforce_organization_restaurant_limit() from public;
create trigger restaurants_organization_capacity before insert or update of organization_id
  on public.restaurants for each row execute function public.enforce_organization_restaurant_limit();
-- Remove the legacy blocker only in the same transaction as the scoped capacity guard.
drop index public.restaurants_owner_id_unique;

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.update_updated_at_column();
create trigger organization_members_updated_at before update on public.organization_members
  for each row execute function public.update_updated_at_column();
create trigger organization_subscriptions_updated_at before update on public.organization_subscriptions
  for each row execute function public.update_updated_at_column();
create trigger account_preferences_updated_at before update on public.account_preferences
  for each row execute function public.update_updated_at_column();
revoke all on public.organizations,public.organization_members,public.organization_subscriptions,
  public.account_preferences,public.restaurant_activation_progress,public.onboarding_intents from public;
commit;
