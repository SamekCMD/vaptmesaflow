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


create or replace function public.sync_restaurant_onboarding_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' or new.onboarding_completed is distinct from old.onboarding_completed then
    new.onboarding_status := case when new.onboarding_completed then 'complete' else 'draft' end;
  else
    new.onboarding_completed := new.onboarding_status = 'complete';
  end if;

  if new.onboarding_completed and new.onboarding_completed_at is null then
    new.onboarding_completed_at := now();
  end if;

  if tg_op = 'INSERT'
    or new.onboarding_step is distinct from old.onboarding_step
    or new.onboarding_status is distinct from old.onboarding_status then
    new.onboarding_updated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_restaurant_onboarding_state on public.restaurants;
create trigger sync_restaurant_onboarding_state
before insert or update of onboarding_completed, onboarding_status, onboarding_step
on public.restaurants
for each row
execute function public.sync_restaurant_onboarding_state();



create or replace function public.save_onboarding_draft(
  p_name text,
  p_slug text,
  p_onboarding_step integer,
  p_restaurant_id uuid default null,
  p_organization_id uuid default null,
  p_whatsapp text default null,
  p_primary_color text default '#0ea573',
  p_secondary_color text default '#1e293b',
  p_total_tables integer default 10
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  slug text,
  whatsapp text,
  primary_color text,
  secondary_color text,
  total_tables integer,
  onboarding_status text,
  onboarding_step smallint,
  onboarding_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_restaurant_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'restaurant name is required' using errcode = '22023';
  end if;
  if btrim(coalesce(p_slug, '')) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'invalid restaurant slug' using errcode = '22023';
  end if;
  if p_onboarding_step not between 0 and 3 then
    raise exception 'invalid onboarding step' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if p_restaurant_id is not null then
    select restaurant.organization_id, restaurant.id
      into v_organization_id, v_restaurant_id
    from public.restaurants as restaurant
    where restaurant.id = p_restaurant_id
      and restaurant.onboarding_status = 'draft'
      and public.has_organization_role(restaurant.organization_id, array['owner', 'admin'], v_user_id)
    for update;
    if v_restaurant_id is null then
      raise exception 'onboarding draft not found' using errcode = '42501';
    end if;
  else
    v_organization_id := p_organization_id;
    if v_organization_id is not null
      and not public.has_organization_role(v_organization_id, array['owner', 'admin'], v_user_id) then
      raise exception 'organization access denied' using errcode = '42501';
    end if;

    if v_organization_id is null then
      select member.organization_id into v_organization_id
      from public.organization_members as member
      where member.user_id = v_user_id
        and member.status = 'active'
        and member.role in ('owner', 'admin')
      order by member.created_at
      limit 1;
    end if;

    if v_organization_id is null then
      v_organization_id := public.get_or_create_default_owner_organization(v_user_id, p_name, now());
    end if;

    select restaurant.id into v_restaurant_id
    from public.restaurants as restaurant
    where restaurant.organization_id = v_organization_id
      and restaurant.onboarding_status = 'draft'
    order by restaurant.created_at
    limit 1
    for update;
  end if;

  if v_restaurant_id is null then
    insert into public.restaurants (
      owner_id, organization_id, name, slug, whatsapp, primary_color,
      secondary_color, total_tables, max_tables, onboarding_status,
      onboarding_step, onboarding_updated_at
    ) values (
      v_user_id, v_organization_id, btrim(p_name), lower(btrim(p_slug)),
      nullif(btrim(coalesce(p_whatsapp, '')), ''), p_primary_color,
      p_secondary_color, greatest(1, p_total_tables), greatest(1, p_total_tables),
      'draft', p_onboarding_step, now()
    ) returning restaurants.id into v_restaurant_id;
  else
    update public.restaurants as restaurant
    set name = btrim(p_name),
        slug = lower(btrim(p_slug)),
        whatsapp = nullif(btrim(coalesce(p_whatsapp, '')), ''),
        primary_color = p_primary_color,
        secondary_color = p_secondary_color,
        total_tables = greatest(1, p_total_tables),
        max_tables = greatest(1, p_total_tables),
        onboarding_step = greatest(restaurant.onboarding_step, p_onboarding_step)
    where restaurant.id = v_restaurant_id;
  end if;

  insert into public.account_preferences (user_id, current_organization_id, current_restaurant_id)
  values (v_user_id, v_organization_id, v_restaurant_id)
  on conflict (user_id) do update
    set current_organization_id = excluded.current_organization_id,
        current_restaurant_id = excluded.current_restaurant_id,
        updated_at = now();

  return query
  select restaurant.id, restaurant.organization_id, restaurant.name, restaurant.slug,
    restaurant.whatsapp, restaurant.primary_color, restaurant.secondary_color,
    restaurant.total_tables, restaurant.onboarding_status,
    restaurant.onboarding_step, restaurant.onboarding_updated_at
  from public.restaurants as restaurant
  where restaurant.id = v_restaurant_id;
end;
$$;

revoke all on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer) from public;
revoke all on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer) from anon;
grant execute on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer) to authenticated;

-- Internal helpers are reached through trusted triggers/RPCs, never directly by clients.
revoke all on function public.get_or_create_default_owner_organization(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.sync_restaurant_onboarding_state() from public, anon, authenticated;


-- The operation-aware overload must require all arguments. Defaults on its
-- trailing parameters also made nine-argument calls match this function.
drop function if exists public.save_onboarding_draft(
  text, text, integer, uuid, uuid, text, text, text, integer, boolean, boolean
);

create or replace function public.save_onboarding_draft(
  p_name text,
  p_slug text,
  p_onboarding_step integer,
  p_restaurant_id uuid,
  p_organization_id uuid,
  p_whatsapp text,
  p_primary_color text,
  p_secondary_color text,
  p_total_tables integer,
  p_local_enabled boolean,
  p_delivery_enabled boolean
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  slug text,
  whatsapp text,
  primary_color text,
  secondary_color text,
  total_tables integer,
  onboarding_status text,
  onboarding_step smallint,
  onboarding_updated_at timestamptz,
  local_enabled boolean,
  delivery_enabled boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_restaurant_id uuid;
begin
  if not coalesce(p_local_enabled, false) and not coalesce(p_delivery_enabled, false) then
    raise exception 'at least one operation mode is required' using errcode = '22023';
  end if;

  select draft.id
    into v_restaurant_id
  from public.save_onboarding_draft(
    p_name,
    p_slug,
    p_onboarding_step,
    p_restaurant_id,
    p_organization_id,
    p_whatsapp,
    p_primary_color,
    p_secondary_color,
    p_total_tables
  ) as draft;

  update public.restaurants as restaurant
  set local_enabled = p_local_enabled,
      delivery_enabled = p_delivery_enabled
  where restaurant.id = v_restaurant_id;

  return query
  select restaurant.id, restaurant.organization_id, restaurant.name, restaurant.slug,
    restaurant.whatsapp, restaurant.primary_color, restaurant.secondary_color,
    restaurant.total_tables, restaurant.onboarding_status,
    restaurant.onboarding_step, restaurant.onboarding_updated_at,
    restaurant.local_enabled, restaurant.delivery_enabled
  from public.restaurants as restaurant
  where restaurant.id = v_restaurant_id;
end;
$$;

revoke all on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer, boolean, boolean)
  from public, anon;
grant execute on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer, boolean, boolean)
  to authenticated;

notify pgrst, 'reload schema';
create or replace function public.finalize_onboarding(p_restaurant_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  onboarding_status text,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant public.restaurants%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select restaurant.*
    into v_restaurant
  from public.restaurants as restaurant
  where restaurant.id = p_restaurant_id
  for update;

  if v_restaurant.id is null
    or not public.has_organization_role(
      v_restaurant.organization_id,
      array['owner', 'admin'],
      v_user_id
    ) then
    raise exception 'onboarding restaurant unavailable' using errcode = '42501';
  end if;

  if v_restaurant.onboarding_status = 'complete' then
    return query
    select restaurant.id, restaurant.organization_id, restaurant.onboarding_status,
      restaurant.onboarding_completed, restaurant.onboarding_completed_at
    from public.restaurants as restaurant
    where restaurant.id = v_restaurant.id;
    return;
  end if;

  if v_restaurant.onboarding_status <> 'draft'
    or length(btrim(v_restaurant.name)) < 2
    or v_restaurant.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or (not v_restaurant.local_enabled and not v_restaurant.delivery_enabled)
    or (v_restaurant.local_enabled and v_restaurant.total_tables < 1) then
    raise exception 'onboarding draft is incomplete' using errcode = '22023';
  end if;

  insert into public.account_preferences (
    user_id,
    current_organization_id,
    current_restaurant_id
  ) values (
    v_user_id,
    v_restaurant.organization_id,
    v_restaurant.id
  )
  on conflict (user_id) do update
    set current_organization_id = excluded.current_organization_id,
        current_restaurant_id = excluded.current_restaurant_id,
        updated_at = now();

  update public.restaurants as restaurant
  set onboarding_completed = true,
      onboarding_status = 'complete',
      onboarding_step = greatest(restaurant.onboarding_step, 2)
  where restaurant.id = v_restaurant.id;

  return query
  select restaurant.id, restaurant.organization_id, restaurant.onboarding_status,
    restaurant.onboarding_completed, restaurant.onboarding_completed_at
  from public.restaurants as restaurant
  where restaurant.id = v_restaurant.id;
end;
$$;

revoke all on function public.finalize_onboarding(uuid) from public, anon;
grant execute on function public.finalize_onboarding(uuid) to authenticated;

notify pgrst, 'reload schema';
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
drop function if exists public.create_public_order_v2(
  text, text, integer, jsonb, jsonb, text, text, text
);

create or replace function public.create_public_order_v2(
  p_restaurant_slug text,
  p_channel text,
  p_table_number integer,
  p_items jsonb,
  p_delivery jsonb,
  p_public_token_hash text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns table (
  order_id uuid,
  display_id bigint,
  restaurant_id uuid,
  table_session_id uuid,
  total_price numeric,
  status text,
  payment_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_existing public.orders%rowtype;
  v_created public.orders%rowtype;
  v_menu_item public.menu_items%rowtype;
  v_item jsonb;
  v_session_id uuid;
  v_total numeric(10,2) := 0;
  v_quantity integer;
  v_menu_item_id uuid;
  v_variation_id uuid;
  v_product_id public.order_items.product_id%type;
  v_status public.orders.status%type;
begin
  if p_channel not in ('local', 'delivery')
    or p_idempotency_key is null
    or length(trim(p_idempotency_key)) < 8
    or p_request_fingerprint is null
    or p_public_token_hash is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_order';
  end if;

  select restaurant.*
    into v_restaurant
    from public.restaurants as restaurant
   where restaurant.slug = p_restaurant_slug
   limit 1;

  if not found then
    raise exception 'restaurant_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_restaurant.id::text, 0));

  select existing_order.*
    into v_existing
    from public.orders as existing_order
   where existing_order.restaurant_id = v_restaurant.id
     and existing_order.creation_idempotency_key = p_idempotency_key
   limit 1;

  if found then
    if v_existing.creation_request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'idempotency_conflict';
    end if;

    return query
      select
        v_existing.id,
        v_existing.display_id::bigint,
        v_existing.restaurant_id,
        v_existing.table_session_id,
        v_existing.total_price,
        v_existing.status::text,
        v_existing.payment_status::text,
        true;
    return;
  end if;

  if (p_channel = 'local' and not v_restaurant.local_enabled)
    or (p_channel = 'delivery' and not v_restaurant.delivery_enabled) then
    raise exception 'channel_unavailable';
  end if;

  if p_channel = 'local' then
    if p_table_number is null or p_table_number < 1 then
      raise exception 'invalid_order';
    end if;
    if p_delivery is not null then
      raise exception 'invalid_order';
    end if;
  else
    if p_table_number is not null
      or p_delivery is null
      or nullif(trim(p_delivery->>'name'), '') is null
      or nullif(trim(p_delivery->>'phone'), '') is null
      or nullif(trim(p_delivery->>'street'), '') is null
      or nullif(trim(p_delivery->>'number'), '') is null
      or nullif(trim(p_delivery->>'neighborhood'), '') is null then
      raise exception 'invalid_order';
    end if;
  end if;

  if p_channel = 'local' and v_restaurant.payment_mode = 'open_tab' then
    select session.id
      into v_session_id
      from public.table_sessions as session
     where session.restaurant_id = v_restaurant.id
       and session.table_number = p_table_number::text
       and session.status in ('open', 'check_requested')
     order by session.created_at desc
     limit 1
     for update;

    if v_session_id is null then
      insert into public.table_sessions (restaurant_id, table_number, status)
      values (v_restaurant.id, p_table_number::text, 'open')
      returning id into v_session_id;
    end if;
  end if;

  v_status := case
    when p_channel = 'local' and v_restaurant.payment_mode = 'prepaid' then 'waiting_payment'
    else 'pending'
  end;

  insert into public.orders (
    restaurant_id,
    table_session_id,
    table_number,
    total_price,
    status,
    order_channel,
    public_access_token_hash,
    creation_idempotency_key,
    creation_request_fingerprint,
    delivery_customer_name,
    delivery_phone,
    delivery_street,
    delivery_number,
    delivery_neighborhood
  ) values (
    v_restaurant.id,
    v_session_id,
    case when p_channel = 'local' then p_table_number::text else null end,
    0,
    v_status,
    p_channel,
    p_public_token_hash,
    p_idempotency_key,
    p_request_fingerprint,
    case when p_channel = 'delivery' then trim(p_delivery->>'name') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'phone') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'street') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'number') else null end,
    case when p_channel = 'delivery' then trim(p_delivery->>'neighborhood') else null end
  )
  returning * into v_created;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_menu_item_id := (v_item->>'menuItemId')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_variation_id := nullif(v_item->>'variationId', '')::uuid;
    exception when others then
      raise exception 'invalid_order';
    end;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'invalid_order';
    end if;

    select menu_item.*
      into v_menu_item
      from public.menu_items as menu_item
     where menu_item.id = v_menu_item_id
     limit 1;

    if not found or not v_menu_item.available then
      raise exception 'item_unavailable';
    end if;

    if v_menu_item.restaurant_id <> v_restaurant.id then
      raise exception 'item_restaurant_mismatch';
    end if;

    if v_variation_id is not null and not exists (
      select 1
        from public.menu_item_variations as variation
       where variation.id = v_variation_id
         and variation.menu_item_id = v_menu_item.id
    ) then
      raise exception 'invalid_order';
    end if;

    v_product_id := v_menu_item.id::text;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      notes
    ) values (
      v_created.id,
      v_product_id,
      v_menu_item.name,
      v_quantity,
      v_menu_item.price,
      coalesce(nullif(trim(v_item->>'notes'), ''), '')
    );

    v_total := v_total + (v_menu_item.price * v_quantity);
  end loop;

  update public.orders
     set total_price = v_total
   where id = v_created.id
   returning * into v_created;

  return query
    select
      v_created.id,
      v_created.display_id::bigint,
      v_created.restaurant_id,
      v_created.table_session_id,
      v_created.total_price,
      v_created.status::text,
      v_created.payment_status::text,
      false;
end;
$$;

revoke all on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_order_v2(text, text, integer, jsonb, jsonb, text, text, text)
  to service_role;
create or replace function public.create_public_order_v3(
  p_restaurant_slug text,
  p_channel text,
  p_table_number integer,
  p_items jsonb,
  p_delivery jsonb,
  p_public_token_hash text,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns table (
  order_id uuid,
  display_id bigint,
  restaurant_id uuid,
  table_session_id uuid,
  total_price numeric,
  status text,
  payment_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_status text;
  v_payment_mode text;
begin
  if p_channel = 'delivery' then
    v_payment_mode := p_delivery->>'paymentMode';
    if v_payment_mode not in ('online', 'on_delivery') then
      raise exception 'invalid_order';
    end if;
  end if;

  select *
    into v_order
    from public.create_public_order_v2(
      p_restaurant_slug,
      p_channel,
      p_table_number,
      p_items,
      p_delivery,
      p_public_token_hash,
      p_idempotency_key,
      p_request_fingerprint
    );

  v_status := v_order.status;

  if p_channel = 'delivery' and v_payment_mode = 'online' then
    update public.orders as order_row
       set status = 'waiting_payment',
           payment_processing_mode = 'online'
     where order_row.id = v_order.order_id
       and order_row.status = 'pending'
       and coalesce(order_row.payment_status::text, '') <> 'paid'
    returning order_row.status::text into v_status;
  end if;

  return query
    select
      v_order.order_id::uuid,
      v_order.display_id::bigint,
      v_order.restaurant_id::uuid,
      v_order.table_session_id::uuid,
      v_order.total_price::numeric,
      coalesce(v_status, v_order.status::text),
      v_order.payment_status::text,
      v_order.idempotent_replay::boolean;
end;
$$;

revoke all on function public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text)
  to service_role;
create or replace function public.apply_payment_transition_v2(
  p_transaction_id uuid,
  p_expected_version integer,
  p_new_status text,
  p_provider_status text,
  p_external_payment_id text,
  p_transitioned_at timestamptz,
  p_checkout_url text,
  p_expires_at timestamptz,
  p_provider_payload jsonb,
  p_effect_types text[]
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_transaction public.payment_transactions%rowtype;
  v_transition_allowed boolean;
  v_effect_type text;
  v_effect_types text[];
begin
  if jsonb_typeof(coalesce(p_provider_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'provider payload must be a JSON object'
      using errcode = '22023';
  end if;

  select *
  into v_transaction
  from public.payment_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'payment transaction not found'
      using errcode = 'P0002';
  end if;

  if p_new_status not in ('created', 'pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded') then
    raise exception 'invalid payment status: %', p_new_status
      using errcode = '22023';
  end if;

  if v_transaction.status <> p_new_status then
    if v_transaction.version <> p_expected_version then
      raise exception 'payment transaction version conflict'
        using errcode = '40001';
    end if;

    v_transition_allowed := case v_transaction.status
      when 'created' then p_new_status in ('pending', 'processing', 'paid', 'failed', 'cancelled')
      when 'pending' then p_new_status in ('processing', 'paid', 'failed', 'cancelled')
      when 'processing' then p_new_status in ('pending', 'paid', 'failed', 'cancelled')
      when 'paid' then p_new_status = 'refunded'
      else false
    end;

    if not v_transition_allowed then
      raise exception 'invalid payment transition: % -> %', v_transaction.status, p_new_status
        using errcode = '23514';
    end if;

    update public.payment_transactions
    set status = p_new_status,
        provider_status = coalesce(p_provider_status, provider_status),
        external_payment_id = coalesce(p_external_payment_id, external_payment_id),
        checkout_url = coalesce(p_checkout_url, checkout_url),
        expires_at = coalesce(p_expires_at, expires_at),
        provider_payload = provider_payload || coalesce(p_provider_payload, '{}'::jsonb),
        paid_at = case
          when p_new_status = 'paid' then coalesce(paid_at, p_transitioned_at)
          else paid_at
        end,
        cancelled_at = case
          when p_new_status = 'cancelled' then coalesce(cancelled_at, p_transitioned_at)
          else cancelled_at
        end,
        refunded_at = case
          when p_new_status = 'refunded' then coalesce(refunded_at, p_transitioned_at)
          else refunded_at
        end,
        version = version + 1
    where id = p_transaction_id
    returning * into v_transaction;
  end if;

  update public.orders
  set payment_transaction_id = v_transaction.id,
      payment_status = v_transaction.status,
      payment_method = v_transaction.payment_method,
      payment_processing_mode = v_transaction.processing_mode,
      payment_confirmed_at = case
        when v_transaction.status = 'paid' then coalesce(payment_confirmed_at, v_transaction.paid_at, p_transitioned_at)
        else payment_confirmed_at
      end
  where id = v_transaction.order_id
    and restaurant_id = v_transaction.restaurant_id;

  v_effect_types := coalesce(
    p_effect_types,
    case
      when v_transaction.status = 'paid' then array[
        'release_order_to_kitchen',
        'record_cashier_revenue',
        'notify_order_paid',
        'reconcile_operational_summary'
      ]::text[]
      else array[]::text[]
    end
  );

  foreach v_effect_type in array v_effect_types loop
    if nullif(btrim(v_effect_type), '') is not null then
      insert into public.payment_effect_outbox (
        restaurant_id,
        payment_transaction_id,
        effect_type
      ) values (
        v_transaction.restaurant_id,
        v_transaction.id,
        btrim(v_effect_type)
      )
      on conflict (payment_transaction_id, effect_type) do nothing;
    end if;
  end loop;

  return v_transaction;
end;
$$;

revoke all on function public.apply_payment_transition_v2(
  uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]
) from public, anon, authenticated;

grant execute on function public.apply_payment_transition_v2(
  uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]
) to service_role;
create index if not exists payment_effect_outbox_expired_lease_idx
  on public.payment_effect_outbox (locked_until)
  where status = 'processing';

create or replace function public.claim_payment_effects(
  p_worker_id text,
  p_limit integer,
  p_locked_at timestamptz,
  p_locked_until timestamptz
)
returns setof public.payment_effect_outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker id is required' using errcode = '22023';
  end if;

  if p_limit < 1 or p_limit > 100 then
    raise exception 'claim limit must be between 1 and 100' using errcode = '22023';
  end if;

  if p_locked_until <= p_locked_at then
    raise exception 'lease expiration must be after claim time' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select effect.id
    from public.payment_effect_outbox effect
    where (
      effect.status in ('pending', 'failed')
      and effect.available_at <= p_locked_at
    ) or (
      effect.status = 'processing'
      and effect.locked_until <= p_locked_at
    )
    order by effect.available_at, effect.created_at
    for update skip locked
    limit p_limit
  )
  update public.payment_effect_outbox effect
  set status = 'processing',
      locked_at = p_locked_at,
      locked_until = p_locked_until,
      locked_by = btrim(p_worker_id)
  from candidates
  where effect.id = candidates.id
  returning effect.*;
end;
$$;

create or replace function public.complete_payment_effect(
  p_effect_id uuid,
  p_worker_id text,
  p_processed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.payment_effect_outbox
  set status = 'completed',
      processed_at = p_processed_at,
      locked_at = null,
      locked_until = null,
      locked_by = null,
      last_error = null
  where id = p_effect_id
    and status = 'processing'
    and locked_by = p_worker_id;

  if not found then
    raise exception 'payment effect lease conflict' using errcode = '40001';
  end if;
end;
$$;

create or replace function public.fail_payment_effect(
  p_effect_id uuid,
  p_worker_id text,
  p_status text,
  p_attempts integer,
  p_available_at timestamptz,
  p_last_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_status not in ('failed', 'dead_letter') then
    raise exception 'invalid payment effect failure status' using errcode = '22023';
  end if;

  if p_attempts < 1 then
    raise exception 'payment effect attempts must be positive' using errcode = '22023';
  end if;

  update public.payment_effect_outbox
  set status = p_status,
      attempts = p_attempts,
      available_at = p_available_at,
      locked_at = null,
      locked_until = null,
      locked_by = null,
      last_error = left(coalesce(p_last_error, 'Unknown payment effect failure'), 500)
  where id = p_effect_id
    and status = 'processing'
    and locked_by = p_worker_id;

  if not found then
    raise exception 'payment effect lease conflict' using errcode = '40001';
  end if;
end;
$$;

create or replace function public.release_paid_order_to_production(
  p_payment_transaction_id uuid,
  p_restaurant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_order_id uuid;
  v_payment_status text;
begin
  select payment.order_id, payment.status
  into v_order_id, v_payment_status
  from public.payment_transactions payment
  where payment.id = p_payment_transaction_id
    and payment.restaurant_id = p_restaurant_id;

  if not found then
    raise exception 'payment transaction not found' using errcode = 'P0002';
  end if;

  if v_payment_status <> 'paid' then
    raise exception 'payment transaction is not paid' using errcode = '23514';
  end if;

  update public.orders
  set status = 'paid'
  where id = v_order_id
    and restaurant_id = p_restaurant_id
    and status = 'waiting_payment';
end;
$$;

create or replace function public.count_pending_payment_effects()
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)
  from public.payment_effect_outbox
  where status in ('pending', 'failed')
    or (status = 'processing' and locked_until <= now());
$$;

revoke all on function public.claim_payment_effects(text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.complete_payment_effect(uuid, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_payment_effect(uuid, text, text, integer, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.release_paid_order_to_production(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.count_pending_payment_effects()
  from public, anon, authenticated;

grant execute on function public.claim_payment_effects(text, integer, timestamptz, timestamptz)
  to service_role;
grant execute on function public.complete_payment_effect(uuid, text, timestamptz)
  to service_role;
grant execute on function public.fail_payment_effect(uuid, text, text, integer, timestamptz, text)
  to service_role;
grant execute on function public.release_paid_order_to_production(uuid, uuid)
  to service_role;
grant execute on function public.count_pending_payment_effects()
  to service_role;
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
