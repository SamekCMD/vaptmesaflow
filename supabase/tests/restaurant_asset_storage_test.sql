begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

create temporary table restaurant_asset_tap_results (
  sequence integer not null,
  result text not null
) on commit drop;

insert into restaurant_asset_tap_results values (0, plan(16));

insert into restaurant_asset_tap_results values (1, ok(exists (
  select 1 from storage.buckets where id = 'restaurant-assets'
), 'restaurant assets bucket exists'));

insert into restaurant_asset_tap_results values (2, is(
  (select public from storage.buckets where id = 'restaurant-assets'),
  true,
  'restaurant assets are publicly readable'
));

insert into restaurant_asset_tap_results values (3, is(
  (select file_size_limit from storage.buckets where id = 'restaurant-assets'),
  2097152::bigint,
  'restaurant assets enforce a two megabyte limit'
));

insert into restaurant_asset_tap_results values (4, is(
  (select allowed_mime_types from storage.buckets where id = 'restaurant-assets'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'restaurant assets accept only supported image formats'
));

insert into restaurant_asset_tap_results values (5, is(
  (select file_size_limit from storage.buckets where id = 'menu-images'),
  5242880::bigint,
  'menu images enforce a five megabyte limit'
));

insert into restaurant_asset_tap_results values (6, is(
  (select allowed_mime_types from storage.buckets where id = 'menu-images'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'menu images accept only supported image formats'
));

insert into restaurant_asset_tap_results values (7, is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'organization_members_delete_menu_images',
        'organization_members_delete_restaurant_assets',
        'organization_members_insert_menu_images',
        'organization_members_insert_restaurant_assets',
        'organization_members_update_menu_images',
        'organization_members_update_restaurant_assets',
        'public_read_menu_images',
        'public_read_restaurant_assets'
      )
  ),
  8,
  'all expected asset policies exist'
));

insert into restaurant_asset_tap_results values (8, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_insert_restaurant_assets' and cmd = 'INSERT'
), 'restaurant asset inserts are policy protected'));

insert into restaurant_asset_tap_results values (9, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_update_restaurant_assets' and cmd = 'UPDATE'
), 'restaurant asset updates are policy protected'));

insert into restaurant_asset_tap_results values (10, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_delete_restaurant_assets' and cmd = 'DELETE'
), 'restaurant asset deletes are policy protected'));

insert into restaurant_asset_tap_results values (11, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_insert_menu_images' and cmd = 'INSERT'
), 'menu image inserts remain policy protected'));

insert into restaurant_asset_tap_results values (12, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_update_menu_images' and cmd = 'UPDATE'
), 'menu image updates remain policy protected'));

insert into restaurant_asset_tap_results values (13, ok(exists (
  select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'organization_members_delete_menu_images' and cmd = 'DELETE'
), 'menu image deletes remain policy protected'));

insert into restaurant_asset_tap_results values (14, ok(
  not public.can_manage_restaurant_storage_object(
    'restaurant-assets',
    'organizations/not-a-uuid/restaurants/not-a-uuid/branding/logo.png',
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'malformed restaurant asset paths fail closed'
));

insert into restaurant_asset_tap_results values (15, ok(
  not public.can_manage_restaurant_storage_object(
    'restaurant-assets',
    'organizations/00000000-0000-0000-0000-000000000001/restaurants/00000000-0000-0000-0000-000000000002/branding',
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'incomplete restaurant asset paths fail closed'
));

insert into restaurant_asset_tap_results values (16, ok(
  not public.can_manage_restaurant_storage_object(
    'unsupported-bucket',
    'organizations/00000000-0000-0000-0000-000000000001/restaurants/00000000-0000-0000-0000-000000000002/branding/logo.png',
    '00000000-0000-0000-0000-000000000001'::uuid
  ),
  'unsupported asset buckets fail closed'
));

insert into restaurant_asset_tap_results
select 17, finish();

select sequence, result
from restaurant_asset_tap_results
order by sequence;

rollback;
