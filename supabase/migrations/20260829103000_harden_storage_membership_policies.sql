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
  v_fourth_segment text;
  v_organization_id uuid;
  v_restaurant_id uuid;
begin
  if p_bucket_id <> 'menu-images' then
    return false;
  end if;

  v_first_segment := split_part(p_object_name, '/', 1);
  v_second_segment := split_part(p_object_name, '/', 2);
  v_fourth_segment := split_part(p_object_name, '/', 4);

  if v_first_segment = 'organizations'
    and v_second_segment ~* '^[0-9a-f-]{36}$'
    and split_part(p_object_name, '/', 3) = 'restaurants'
    and v_fourth_segment ~* '^[0-9a-f-]{36}$'
  then
    v_organization_id := v_second_segment::uuid;
    v_restaurant_id := v_fourth_segment::uuid;
  elsif v_first_segment ~* '^[0-9a-f-]{36}$' then
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

drop policy if exists "auth_upload_menu_images" on storage.objects;
drop policy if exists "auth_update_menu_images" on storage.objects;
drop policy if exists "auth_delete_menu_images" on storage.objects;

drop policy if exists "organization_members_insert_menu_images" on storage.objects;
create policy "organization_members_insert_menu_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);

drop policy if exists "organization_members_update_menu_images" on storage.objects;
create policy "organization_members_update_menu_images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'menu-images'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
)
with check (
  bucket_id = 'menu-images'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);

drop policy if exists "organization_members_delete_menu_images" on storage.objects;
create policy "organization_members_delete_menu_images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and public.can_manage_restaurant_storage_object(bucket_id, name)
);
