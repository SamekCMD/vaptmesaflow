begin;

-- Names confirmed in the self-hosted deployment differ from the repository's
-- original policy names. Permissive policies otherwise bypass membership via OR.
drop policy if exists "Owners can view own restaurant" on public.restaurants;
drop policy if exists "Owners can insert restaurant" on public.restaurants;
drop policy if exists "Owners can update own restaurant" on public.restaurants;
drop policy if exists "Public can view restaurant by slug" on public.restaurants;

-- Cover both historical naming variants when replaying on other deployments.
drop policy if exists owners_select_own on public.restaurants;
drop policy if exists owners_insert_own on public.restaurants;
drop policy if exists owners_update_own on public.restaurants;
drop policy if exists public_read_by_slug on public.restaurants;
drop policy if exists authenticated_read_by_slug on public.restaurants;

-- Public menus use get_public_restaurant_by_slug, not direct table reads.
notify pgrst, 'reload schema';
commit;
