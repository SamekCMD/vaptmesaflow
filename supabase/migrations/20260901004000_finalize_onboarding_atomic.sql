begin;

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

commit;
