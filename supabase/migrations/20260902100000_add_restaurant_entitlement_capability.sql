begin;

create or replace function public.get_plan_max_restaurants(p_plan_type text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_plan_type, 'starter'))
    when 'starter' then 1
    when 'trial' then 1
    when 'trialing' then 1
    when 'pro' then 1
    when 'business' then 25
    -- Compatibility aliases while legacy subscription values are retired.
    when 'growth' then 3
    when 'scale' then 25
    when 'enterprise' then 25
    else 1
  end;
$$;

create or replace function public.get_restaurant_creation_entitlement(p_organization_id uuid)
returns table (
  can_create boolean,
  role text,
  plan_type text,
  current_restaurants integer,
  max_restaurants integer,
  reason text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_plan_type text;
  v_current_restaurants integer;
  v_max_restaurants integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select member.role
    into v_role
  from public.organization_members as member
  where member.organization_id = p_organization_id
    and member.user_id = v_user_id
    and member.status = 'active';

  if v_role is null then
    return query select false, null::text, null::text, null::integer, null::integer, 'membership_required'::text;
    return;
  end if;

  if v_role not in ('owner', 'admin') then
    return query select false, v_role, null::text, null::integer, null::integer, 'role_denied'::text;
    return;
  end if;

  select coalesce(subscription.plan_type, 'starter')
    into v_plan_type
  from public.organization_subscriptions as subscription
  where subscription.organization_id = p_organization_id;
  v_plan_type := coalesce(v_plan_type, 'starter');
  v_max_restaurants := public.get_plan_max_restaurants(v_plan_type);

  select count(*)::integer
    into v_current_restaurants
  from public.restaurants as restaurant
  where restaurant.organization_id = p_organization_id;

  return query select
    v_current_restaurants < v_max_restaurants,
    v_role,
    v_plan_type,
    v_current_restaurants,
    v_max_restaurants,
    case when v_current_restaurants >= v_max_restaurants then 'plan_limit'::text else null::text end;
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

  -- Serialize restaurant creation per organization so concurrent inserts cannot exceed the limit.
  perform 1
  from public.organizations as organization
  where organization.id = new.organization_id
  for update;

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

revoke all on function public.get_restaurant_creation_entitlement(uuid) from public, anon;
grant execute on function public.get_restaurant_creation_entitlement(uuid) to authenticated;
revoke all on function public.enforce_restaurant_entitlement() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
