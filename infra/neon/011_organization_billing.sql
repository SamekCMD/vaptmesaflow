-- Local rehearsal only. Paired compatible API/email consumer rollout is required.
-- No provider calls, credentials, schedules or external resources are created.
begin;
do $guard$
begin
  if current_database()<>'vapt' or to_regclass('public.organization_subscriptions') is null then
    raise exception 'organization billing: expected vapt with tenant foundation010';
  end if;
end
$guard$;

create temporary table organization_billing_origins on commit drop as
  select r.organization_id,r.id restaurant_id,r.owner_id legacy_owner_id,'customer'::text resource_type,r.stripe_customer_id resource_id
  from public.restaurants r where r.stripe_customer_id is not null
  union all select r.organization_id,r.id,r.owner_id,'subscription',r.stripe_subscription_id from public.restaurants r where r.stripe_subscription_id is not null
  union all select r.organization_id,r.id,r.owner_id,'checkout',r.stripe_checkout_session_id from public.restaurants r where r.stripe_checkout_session_id is not null;

do $preflight$
begin
  if exists(select resource_id from organization_billing_origins group by resource_id
    having count(distinct jsonb_build_array(organization_id,restaurant_id,legacy_owner_id,resource_type))>1) then
    raise exception 'organization billing: conflicting legacy Stripe origin';
  end if;
  if exists(select 1 from organization_billing_origins origin
    join public.organization_subscriptions subscription using(organization_id)
    where origin.resource_id is distinct from case origin.resource_type
      when 'customer' then subscription.stripe_customer_id when 'subscription' then subscription.stripe_subscription_id
      when 'checkout' then subscription.stripe_checkout_session_id end) then
    raise exception 'organization billing: legacy and canonical resource conflict';
  end if;
  if exists(select 1 from public.organization_subscriptions subscription cross join lateral(values
    ('customer',subscription.stripe_customer_id),('subscription',subscription.stripe_subscription_id),('checkout',subscription.stripe_checkout_session_id)) resource(kind,id)
    where resource.id is not null and not exists(select 1 from organization_billing_origins origin
      where origin.organization_id=subscription.organization_id and origin.resource_type=resource.kind and origin.resource_id=resource.id)) then
    raise exception 'organization billing: missing immutable legacy resource origin';
  end if;
  if exists(select restaurant.organization_id,outbox.billing_resource_id,outbox.email_kind
    from public.billing_email_outbox outbox join public.restaurants restaurant on restaurant.id=outbox.restaurant_id
    group by restaurant.organization_id,outbox.billing_resource_id,outbox.email_kind having count(*)>1) then
    raise exception 'organization billing: conflicting organization email intent; reconcile without discarding deliveries';
  end if;
end
$preflight$;

create table public.organization_billing_resources(
  resource_id text primary key check(length(resource_id) between 1 and 255),
  resource_type text not null check(resource_type in ('customer','subscription','checkout')),
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  unique(resource_id,organization_id),
  unique(resource_id,resource_type,organization_id)
);
create table public.organization_billing_legacy_resources(
  resource_id text primary key,
  resource_type text not null,
  organization_id uuid not null,
  restaurant_id uuid not null,
  legacy_owner_id uuid not null references better_auth."user"(id),
  created_at timestamptz not null default now(),
  foreign key(resource_id,resource_type,organization_id)
    references public.organization_billing_resources(resource_id,resource_type,organization_id),
  foreign key(restaurant_id,organization_id) references public.restaurants(id,organization_id)
);
insert into public.organization_billing_resources(resource_id,resource_type,organization_id)
  select resource_id,resource_type,organization_id from organization_billing_origins;
insert into public.organization_billing_legacy_resources(resource_id,resource_type,organization_id,restaurant_id,legacy_owner_id)
  select resource_id,resource_type,organization_id,restaurant_id,legacy_owner_id from organization_billing_origins;

create function public.reject_billing_resource_reassignment() returns trigger
language plpgsql set search_path=pg_catalog,public as $function$
begin
  raise exception using errcode='23514',constraint='organization_billing_resource_immutable',message='Billing resource associations are immutable';
end
$function$;
revoke all on function public.reject_billing_resource_reassignment() from public;
create trigger organization_billing_resources_immutable before update or delete on public.organization_billing_resources
  for each row execute function public.reject_billing_resource_reassignment();
create trigger organization_billing_legacy_resources_immutable before update or delete on public.organization_billing_legacy_resources
  for each row execute function public.reject_billing_resource_reassignment();

alter table public.organization_subscriptions
  add constraint organization_subscription_customer_association foreign key(stripe_customer_id,organization_id)
    references public.organization_billing_resources(resource_id,organization_id),
  add constraint organization_subscription_subscription_association foreign key(stripe_subscription_id,organization_id)
    references public.organization_billing_resources(resource_id,organization_id),
  add constraint organization_subscription_checkout_association foreign key(stripe_checkout_session_id,organization_id)
    references public.organization_billing_resources(resource_id,organization_id);

create temporary table organization_billing_event_candidates on commit drop as
  select event.id,restaurant.organization_id from public.billing_provider_events event
    join public.restaurants restaurant on restaurant.id=event.restaurant_id
  union all select event.id,resource.organization_id from public.billing_provider_events event
    join public.organization_billing_resources resource on resource.resource_type='customer'
      and (resource.resource_id=event.stripe_customer_id or resource.resource_id=event.payload->>'customerId') where event.provider='stripe'
  union all select event.id,resource.organization_id from public.billing_provider_events event
    join public.organization_billing_resources resource on resource.resource_type='subscription'
      and (resource.resource_id=event.stripe_subscription_id or resource.resource_id=event.payload->>'subscriptionId') where event.provider='stripe'
  union all select event.id,restaurant.organization_id from public.billing_provider_events event
    join public.restaurants restaurant on restaurant.id::text=event.payload#>>'{metadata,vapt_restaurant_id}' where event.provider='stripe'
  union all select event.id,organization.id from public.billing_provider_events event
    join public.organizations organization on organization.id::text=event.payload#>>'{metadata,vapt_organization_id}' where event.provider='stripe';
do $events$
begin
  if exists(select id from organization_billing_event_candidates group by id having count(distinct organization_id)>1) then
    raise exception 'organization billing: event resource association conflict';
  end if;
end
$events$;
alter table public.billing_provider_events add column organization_id uuid references public.organizations(id);
update public.billing_provider_events event set organization_id=candidate.organization_id from
  (select distinct id,organization_id from organization_billing_event_candidates) candidate where candidate.id=event.id;
create index billing_provider_events_organization_idx on public.billing_provider_events(organization_id,created_at);

alter table public.billing_email_outbox add column organization_id uuid references public.organizations(id);
alter table public.billing_email_outbox disable trigger billing_email_outbox_updated_at;
update public.billing_email_outbox outbox set organization_id=restaurant.organization_id
  from public.restaurants restaurant where restaurant.id=outbox.restaurant_id;
alter table public.billing_email_outbox enable trigger billing_email_outbox_updated_at;
alter table public.billing_email_outbox
  alter column organization_id set not null,
  alter column restaurant_id drop not null,
  drop constraint billing_email_outbox_restaurant_fkey,
  drop constraint billing_email_outbox_resource_kind_key,
  add constraint billing_email_outbox_origin_organization_fkey foreign key(restaurant_id,organization_id)
    references public.restaurants(id,organization_id),
  add constraint billing_email_outbox_organization_resource_kind_key unique(organization_id,billing_resource_id,email_kind);
create index billing_email_outbox_organization_idx on public.billing_email_outbox(organization_id,created_at);

-- Stripe identity and plan have one authoritative organization source from now on.
create function public.reject_legacy_restaurant_billing_write() returns trigger
language plpgsql set search_path=pg_catalog,public as $function$
begin
  if jsonb_build_array(new.plan_type,new.plan_status,new.trial_ends_at,new.stripe_customer_id,new.stripe_subscription_id,
    new.stripe_subscription_item_id,new.stripe_current_period_end,new.stripe_cancel_at_period_end,new.stripe_state_updated_at,
    new.stripe_checkout_session_id,new.stripe_checkout_plan_type,new.stripe_checkout_expires_at,new.billing_last_error,new.subscription_canceled_at)
    is distinct from jsonb_build_array(old.plan_type,old.plan_status,old.trial_ends_at,old.stripe_customer_id,old.stripe_subscription_id,
    old.stripe_subscription_item_id,old.stripe_current_period_end,old.stripe_cancel_at_period_end,old.stripe_state_updated_at,
    old.stripe_checkout_session_id,old.stripe_checkout_plan_type,old.stripe_checkout_expires_at,old.billing_last_error,old.subscription_canceled_at) then
    raise exception using errcode='23514',constraint='restaurant_billing_is_legacy',message='Restaurant billing fields are read-only legacy state';
  end if;
  return new;
end
$function$;
revoke all on function public.reject_legacy_restaurant_billing_write() from public;
create trigger restaurants_legacy_billing_read_only before update on public.restaurants
  for each row execute function public.reject_legacy_restaurant_billing_write();
revoke all on public.organization_billing_resources,public.organization_billing_legacy_resources from public;
-- Only the claimed Stripe event can reconcile authoritative entitlements.
create function public.reconcile_organization_subscription(
  target_organization uuid,event_id text,claim_attempt integer,customer_id text,subscription_id text,
  subscription_item_id text,next_plan text,next_status text,next_trial_end timestamptz,next_period_end timestamptz,
  cancel_at_period_end boolean,canceled_at timestamptz,observed_at timestamptz,completed_checkout text,last_billing_error text
) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $function$
begin
  perform 1 from public.billing_provider_events
    where provider='stripe' and provider_event_id=event_id and attempt_count=claim_attempt
      and processing_status='processing' and organization_id=target_organization
      and processing_started_at>clock_timestamp()-interval '60 seconds' for update;
  if not found then raise exception using errcode='42501',message='Active billing claim required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenant:organization:'||target_organization::text,0));
  if not exists(select 1 from public.organization_billing_resources where resource_id=customer_id
      and resource_type='customer' and organization_id=target_organization)
    or not exists(select 1 from public.organization_billing_resources where resource_id=subscription_id
      and resource_type='subscription' and organization_id=target_organization) then
    raise exception using errcode='23514',message='Billing resource association conflicts';
  end if;
  update public.organization_subscriptions set stripe_customer_id=customer_id,stripe_subscription_id=subscription_id,
    stripe_subscription_item_id=subscription_item_id,plan_type=next_plan,plan_status=next_status,
    trial_ends_at=case when trial_started_at is not null then trial_ends_at else next_trial_end end,
    stripe_current_period_end=next_period_end,stripe_cancel_at_period_end=cancel_at_period_end,
    subscription_canceled_at=canceled_at,stripe_state_updated_at=observed_at,billing_last_error=last_billing_error,
    stripe_checkout_session_id=case when stripe_checkout_session_id=completed_checkout then null else stripe_checkout_session_id end,
    stripe_checkout_plan_type=case when stripe_checkout_session_id=completed_checkout then null else stripe_checkout_plan_type end,
    stripe_checkout_expires_at=case when stripe_checkout_session_id=completed_checkout then null else stripe_checkout_expires_at end
    where organization_id=target_organization;
  return found;
end
$function$;
revoke all on function public.reconcile_organization_subscription(uuid,text,integer,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,timestamptz,text,text) from public;
create function public.preserve_billing_event_organization() returns trigger
language plpgsql set search_path=pg_catalog,public as $function$
begin
  if old.organization_id is not null and new.organization_id is distinct from old.organization_id then
    raise exception using errcode='23514',message='Billing event organization is immutable';
  end if;
  return new;
end
$function$;
revoke all on function public.preserve_billing_event_organization() from public;
create trigger billing_event_organization_immutable before update of organization_id on public.billing_provider_events
  for each row execute function public.preserve_billing_event_organization();
commit;
