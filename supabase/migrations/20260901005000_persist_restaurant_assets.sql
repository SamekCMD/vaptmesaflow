insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'restaurant-assets',
  'restaurant-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'menu-images';

create or replace function public.can_manage_restaurant_storage_object(
  p_bucket_id text,
  p_object_name text,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_first_segment text;
  v_second_segment text;
  v_third_segment text;
  v_fourth_segment text;
  v_fifth_segment text;
  v_sixth_segment text;
  v_seventh_segment text;
  v_eighth_segment text;
  v_organization_id uuid;
  v_restaurant_id uuid;
begin
  if p_bucket_id not in ('menu-images', 'restaurant-assets') then
    return false;
  end if;

  v_first_segment := split_part(p_object_name, '/', 1);
  v_second_segment := split_part(p_object_name, '/', 2);
  v_third_segment := split_part(p_object_name, '/', 3);
  v_fourth_segment := split_part(p_object_name, '/', 4);
  v_fifth_segment := split_part(p_object_name, '/', 5);
  v_sixth_segment := split_part(p_object_name, '/', 6);
  v_seventh_segment := split_part(p_object_name, '/', 7);
  v_eighth_segment := split_part(p_object_name, '/', 8);

  if v_first_segment = 'organizations'
    and v_second_segment ~* '^[0-9a-f-]{36}$'
    and v_third_segment = 'restaurants'
    and v_fourth_segment ~* '^[0-9a-f-]{36}$'
    and (
      (
        p_bucket_id = 'restaurant-assets'
        and v_fifth_segment = 'branding'
        and v_sixth_segment <> ''
        and v_seventh_segment = ''
      )
      or (
        p_bucket_id = 'menu-images'
        and v_fifth_segment = 'menu-items'
        and v_sixth_segment ~* '^[0-9a-f-]{36}$'
        and v_seventh_segment <> ''
        and v_eighth_segment = ''
      )
    )
  then
    v_organization_id := v_second_segment::uuid;
    v_restaurant_id := v_fourth_segment::uuid;
  elsif p_bucket_id = 'menu-images'
    and v_first_segment ~* '^[0-9a-f-]{36}$'
    and v_second_segment <> ''
    and v_third_segment = ''
  then
    -- Existing product images remain manageable during the path migration.
    v_restaurant_id := v_first_segment::uuid;
  else
    return false;
  end if;

  return exists (
    select 1
    from public.restaurants as restaurant
    where restaurant.id = v_restaurant_id
      and (v_organization_id is null or restaurant.organization_id = v_organization_id)
      and public.has_organization_role(
        restaurant.organization_id,
        array['owner', 'admin', 'manager'],
        p_user_id
      )
  );
end;
$$;

drop policy if exists "public_read_restaurant_assets" on storage.objects;
create policy "public_read_restaurant_assets"
on storage.objects
for select
using (bucket_id = 'restaurant-assets');

drop policy if exists "public_read_menu_images" on storage.objects;
create policy "public_read_menu_images"
on storage.objects
for select
using (bucket_id = 'menu-images');

drop policy if exists "organization_members_insert_restaurant_assets" on storage.objects;
create policy "organization_members_insert_restaurant_assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'restaurant-assets'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);

drop policy if exists "organization_members_update_restaurant_assets" on storage.objects;
create policy "organization_members_update_restaurant_assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'restaurant-assets'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
)
with check (
  bucket_id = 'restaurant-assets'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);

drop policy if exists "organization_members_delete_restaurant_assets" on storage.objects;
create policy "organization_members_delete_restaurant_assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'restaurant-assets'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);

notify pgrst, 'reload schema';
