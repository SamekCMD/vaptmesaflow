-- Expoe somente os campos necessarios para as vitrines publicas.
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
    restaurant.id,
    restaurant.name,
    restaurant.slug,
    restaurant.logo_url,
    restaurant.primary_color,
    restaurant.secondary_color,
    restaurant.font_family,
    restaurant.payment_mode,
    restaurant.max_pending_orders,
    restaurant.local_enabled,
    restaurant.delivery_enabled
  from public.restaurants as restaurant
  where restaurant.slug = p_slug
  limit 1;
$$;

revoke all on function public.get_public_restaurant_by_slug(text) from public;
grant execute on function public.get_public_restaurant_by_slug(text) to anon, authenticated, service_role;

-- O acesso autenticado continua limitado pelas policies do proprietario.
drop policy if exists "public_read_by_slug" on public.restaurants;
drop policy if exists "authenticated_read_by_slug" on public.restaurants;

revoke select on table public.restaurants from anon;
