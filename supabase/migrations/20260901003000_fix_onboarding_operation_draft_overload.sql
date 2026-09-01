-- The operation-aware overload must require all arguments. Defaults on its
-- trailing parameters also made nine-argument calls match this function.
begin;

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

commit;
