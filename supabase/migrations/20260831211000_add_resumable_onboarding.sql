alter table public.restaurants
  add column if not exists onboarding_status text not null default 'draft',
  add column if not exists onboarding_step smallint not null default 0,
  add column if not exists onboarding_updated_at timestamptz not null default now();

update public.restaurants
set onboarding_status = case when onboarding_completed then 'complete' else 'draft' end;

alter table public.restaurants
  drop constraint if exists restaurants_onboarding_status_check,
  add constraint restaurants_onboarding_status_check
    check (onboarding_status in ('draft', 'complete')),
  drop constraint if exists restaurants_onboarding_step_check,
  add constraint restaurants_onboarding_step_check
    check (onboarding_step between 0 and 3);

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
grant execute on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer) to authenticated;

-- Internal helpers are reached through trusted triggers/RPCs, never directly by clients.
revoke all on function public.get_or_create_default_owner_organization(uuid, text, timestamptz) from public;
