-- Run the whole script as postgres in the Supabase SQL editor AFTER migrations.
-- Fixtures, grants, and pgTAP state are rolled back. Never run fragments alone.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

create temporary table billing_boundary_results (
  sequence integer primary key,
  result text not null
) on commit drop;
-- Explicit numbers avoid sequence ACLs; INSERT plus SELECT supports all editor
-- execution paths after SET ROLE without granting access to any real data.
grant select, insert on billing_boundary_results to authenticated, anon, service_role;
insert into billing_boundary_results values (0, plan(50));

insert into auth.users (id, aud, role, email, created_at, updated_at)
select id::uuid, 'authenticated', 'authenticated', email, now(), now()
from (values
  ('b1000000-0000-4000-8000-000000000001', 'boundary-owner@example.test'),
  ('b1000000-0000-4000-8000-000000000002', 'boundary-staff@example.test'),
  ('b1000000-0000-4000-8000-000000000003', 'boundary-revoked@example.test'),
  ('b1000000-0000-4000-8000-000000000004', 'boundary-onboarding@example.test')
) as users(id, email);
insert into public.organizations (id, name, created_by) values
  ('b2000000-0000-4000-8000-000000000001', 'Boundary A', 'b1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000002', 'Boundary B', 'b1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000003', 'Boundary revoked', 'b1000000-0000-4000-8000-000000000003');
insert into public.organization_members (organization_id, user_id, role, status) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002', 'staff', 'active'),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'owner', 'disabled');
insert into public.organization_subscriptions
  (organization_id, plan_type, plan_status, trial_ends_at)
select id, 'starter', 'trialing', now() + interval '3 days'
from public.organizations where id in (
  'b2000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000002',
  'b2000000-0000-4000-8000-000000000003'
);
insert into public.restaurants (id, organization_id, owner_id, name, slug) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Boundary A', 'billing-boundary-a'),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', 'Boundary revoked', 'billing-boundary-revoked');

-- Effective ACL checks include inherited/PUBLIC and per-column grants, not just
-- information_schema.table_privileges or the absence of permissive policies.
insert into billing_boundary_results select 1, ok(not exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurants'
  and policyname not in (
    'organization_members_select_restaurants',
    'organization_members_update_restaurants',
    'organization_members_insert_restaurants'
  )
), 'only the expected membership restaurant policies remain');
insert into billing_boundary_results select 2, ok(not exists (
  select 1 from (values ('anon'), ('authenticated')) r(role_name)
  cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
  where has_table_privilege(r.role_name, 'public.organization_subscriptions', p.privilege)
), 'clients have no effective subscription table write privileges');
insert into billing_boundary_results select 3, ok(not exists (
  select 1 from pg_attribute a
  cross join (values ('anon'), ('authenticated')) r(role_name)
  cross join (values ('INSERT'), ('UPDATE'), ('REFERENCES')) p(privilege)
  where a.attrelid = 'public.organization_subscriptions'::regclass and a.attnum > 0 and not a.attisdropped
  and has_column_privilege(r.role_name, a.attrelid, a.attnum, p.privilege)
), 'clients have no effective subscription column write privileges');
insert into billing_boundary_results select 4, ok(not exists (
  select 1 from pg_attribute a where a.attrelid = 'public.organization_subscriptions'::regclass
  and a.attnum > 0 and not a.attisdropped
  and a.attname not in ('organization_id', 'plan_type', 'plan_status', 'trial_ends_at')
  and has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
), 'authenticated cannot select any non-allowlisted billing column');
insert into billing_boundary_results select 5, ok(not exists (
  select 1 from pg_attribute a where a.attrelid = 'public.organization_subscriptions'::regclass
  and a.attnum > 0 and not a.attisdropped
  and has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')
), 'anonymous cannot select any subscription column');
insert into billing_boundary_results select 6, ok(
  (select relrowsecurity from pg_class where oid = 'public.organization_subscriptions'::regclass),
  'subscription authority is protected by RLS');
insert into billing_boundary_results select 7, is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'organization_subscriptions'),
  7, 'subscription schema contains only canonical lifecycle columns');
insert into billing_boundary_results select 8, ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'organization_subscriptions'
    and column_name ~* '(secret|token|credential|provider)'
), 'subscription schema contains no provider credentials');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into billing_boundary_results select 9, results_eq(
  $$select organization_id::text, plan_type, plan_status, (trial_ends_at > now()) from public.organization_subscriptions where organization_id = 'b2000000-0000-4000-8000-000000000001'$$,
  $$values ('b2000000-0000-4000-8000-000000000001'::text, 'starter'::text, 'trialing'::text, true)$$,
  'owner can use the exact frontend safe projection');
insert into billing_boundary_results select 10, throws_ok(
  $$update public.organization_subscriptions set plan_type = 'business' where organization_id = 'b2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot self-upgrade');
insert into billing_boundary_results select 11, throws_ok(
  $$update public.organization_subscriptions set plan_status = 'active', trial_ends_at = now() + interval '100 years' where organization_id = 'b2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot activate or extend trial');
insert into billing_boundary_results select 12, throws_ok(
  $$insert into public.organization_subscriptions (organization_id, plan_type) values ('b2000000-0000-4000-8000-000000000001', 'business') on conflict (organization_id) do update set plan_type = excluded.plan_type$$,
  '42501', null, 'owner cannot upsert authoritative billing');
insert into billing_boundary_results select 13, throws_ok(
  $$delete from public.organization_subscriptions where organization_id = 'b2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'owner cannot delete subscription to restart billing');
insert into billing_boundary_results select 14, ok(not exists (
  select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'organization_subscriptions' and column_name like '%secret%'
), 'subscription schema contains no provider secrets');
insert into billing_boundary_results select 15, ok(
  has_column_privilege('authenticated', 'public.organization_subscriptions', 'plan_type', 'SELECT'),
  'owner receives the safe plan projection grant');
insert into billing_boundary_results select 16, throws_ok(
  $$update public.restaurants set owner_id = 'b1000000-0000-4000-8000-000000000002' where id = 'b3000000-0000-4000-8000-000000000001'$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'owner cannot reassign legacy ownership');
insert into billing_boundary_results select 17, throws_ok(
  $$update public.restaurants set organization_id = 'b2000000-0000-4000-8000-000000000002' where id = 'b3000000-0000-4000-8000-000000000001'$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'owner of both organizations still cannot transfer a restaurant');
insert into billing_boundary_results select 18, throws_ok(
  $$update public.restaurants set organization_id = null where id = 'b3000000-0000-4000-8000-000000000001'$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'guard runs before definer organization auto-assignment');
insert into billing_boundary_results select 19, lives_ok(
  $$update public.restaurants set name = 'Boundary renamed', owner_id = owner_id, organization_id = organization_id where id = 'b3000000-0000-4000-8000-000000000001'$$,
  'ordinary settings and unchanged boundary fields remain writable');
insert into billing_boundary_results select 20, throws_ok(
  $$insert into public.restaurants (owner_id, organization_id, name, slug) values ('b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Forged owner', 'billing-boundary-forged')$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'direct insert cannot assign another owner');

set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into billing_boundary_results select 21, results_eq(
  $$select organization_id::text, plan_type, plan_status, (trial_ends_at > now()) from public.organization_subscriptions order by organization_id$$,
  $$values ('b2000000-0000-4000-8000-000000000001'::text, 'starter'::text, 'trialing'::text, true)$$,
  'staff can read only its own safe subscription projection');
insert into billing_boundary_results select 22, ok(not exists (
  select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'organization_subscriptions'
    and column_name not in ('organization_id', 'plan_type', 'plan_status', 'trial_ends_at', 'subscription_canceled_at', 'created_at', 'updated_at')
), 'subscription schema has no provider-specific secret columns');
insert into billing_boundary_results select 23, results_eq(
  $$select organization_id::text, plan_type, plan_status, (trial_ends_at > now()) from public.organization_subscriptions$$,
  $$values ('b2000000-0000-4000-8000-000000000001'::text, 'starter'::text, 'trialing'::text, true)$$,
  'staff safe projection exposes only its tenant row');
insert into billing_boundary_results select 24, ok(
  not has_table_privilege('authenticated', 'public.organization_subscriptions', 'UPDATE'),
  'staff cannot update authoritative subscription state');

set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}';
insert into billing_boundary_results select 25, is(
  (select count(*)::integer from public.restaurants where id = 'b3000000-0000-4000-8000-000000000003'),
  0, 'disabled owner membership cannot read via legacy owner_id');
insert into billing_boundary_results select 26, results_eq(
  $$update public.restaurants set name = 'Unauthorized' where id = 'b3000000-0000-4000-8000-000000000003' returning id$$,
  $$select null::uuid where false$$, 'disabled owner membership cannot update via legacy owner_id');
reset role;
delete from public.organization_members where organization_id = 'b2000000-0000-4000-8000-000000000003';
set local role authenticated;
insert into billing_boundary_results select 27, is(
  (select count(*)::integer from public.restaurants where id = 'b3000000-0000-4000-8000-000000000003'),
  0, 'deleted membership cannot read via legacy owner_id');
insert into billing_boundary_results select 28, results_eq(
  $$update public.restaurants set name = 'Unauthorized' where id = 'b3000000-0000-4000-8000-000000000003' returning id$$,
  $$select null::uuid where false$$, 'deleted membership cannot update via legacy owner_id');
insert into billing_boundary_results select 29, throws_ok(
  $$insert into public.restaurants (owner_id, organization_id, name, slug) values ('b1000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', 'Revoked insert', 'billing-boundary-revoked-insert')$$,
  '42501', null, 'legacy owner insert policy no longer bypasses membership');
insert into billing_boundary_results select 30, is(
  (select count(organization_id)::integer from public.organization_subscriptions),
  0, 'removed member has no safe billing reads either');

-- A fresh authenticated user has no membership. Trusted definer RPCs must still
-- create the organization and restaurant, then initialize billing via a trigger.
set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}';
insert into billing_boundary_results select 31, lives_ok(
  $$select * from public.save_onboarding_draft('Boundary onboarding', 'billing-boundary-onboarding', 2, null::uuid, null::uuid, null::text, '#0ea573', '#1e293b', 5, true, false)$$,
  'trusted onboarding RPC creates a first organization and restaurant');
insert into billing_boundary_results select 32, lives_ok(
  $$select * from public.finalize_onboarding((select id from public.restaurants where slug = 'billing-boundary-onboarding'))$$,
  'trusted onboarding finalization and definer billing trigger still work');
insert into billing_boundary_results select 33, results_eq(
  $$select plan_type, plan_status, (trial_ends_at > now()) from public.organization_subscriptions$$,
  $$values ('starter'::text, 'trialing'::text, true)$$,
  'onboarding actually initialized the starter trial');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into billing_boundary_results select 34, throws_ok(
  $$select organization_id from public.organization_subscriptions$$,
  '42501', null, 'anonymous cannot read even safe billing fields');
insert into billing_boundary_results select 35, ok(
  not has_table_privilege('anon', 'public.organization_subscriptions', 'SELECT'),
  'anonymous has no subscription table grant');

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
insert into billing_boundary_results select 36, lives_ok(
  $$insert into public.organization_subscriptions (organization_id, plan_type, plan_status) values ('b2000000-0000-4000-8000-000000000001', 'business', 'active') on conflict (organization_id) do update set plan_type = excluded.plan_type, plan_status = excluded.plan_status$$,
  'trusted backend can upsert authoritative billing');
insert into billing_boundary_results select 37, is(
  (select plan_status from public.organization_subscriptions where organization_id = 'b2000000-0000-4000-8000-000000000001'),
  'active', 'trusted backend can read authoritative billing state');
insert into billing_boundary_results select 38, ok(
  has_table_privilege('service_role', 'public.organization_subscriptions', 'UPDATE'),
  'trusted backend can update authoritative subscription state');
insert into billing_boundary_results select 39, ok(not exists (
  select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'organization_subscriptions' and column_name like '%token%'
), 'authoritative billing state stores no retired provider tokens');
insert into billing_boundary_results select 40, lives_ok(
  $$update public.restaurants set owner_id = 'b1000000-0000-4000-8000-000000000002', organization_id = 'b2000000-0000-4000-8000-000000000002' where id = 'b3000000-0000-4000-8000-000000000001'$$,
  'trusted backend retains deliberate ownership and organization transfer');

reset role;
update public.organization_members set role = 'admin'
where organization_id = 'b2000000-0000-4000-8000-000000000001'
  and user_id = 'b1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into billing_boundary_results select 41, throws_ok(
  $$update public.organization_subscriptions set plan_type = 'business', plan_status = 'active' where organization_id = 'b2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'admin cannot write authoritative billing either');
insert into billing_boundary_results select 42, ok(not exists (
  select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'organization_subscriptions' and column_name like '%secret%'
), 'admin-facing subscription schema contains no billing secrets');
insert into billing_boundary_results select 43, throws_ok(
  $$insert into public.restaurants (owner_id, name, slug) values ('b1000000-0000-4000-8000-000000000001', 'Implicit organization', 'billing-boundary-implicit')$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'direct insert cannot invoke definer organization auto-assignment');
insert into billing_boundary_results select 44, throws_ok(
  $$insert into public.restaurants (owner_id, organization_id, name, slug) values (null, 'b2000000-0000-4000-8000-000000000001', 'Null owner', 'billing-boundary-null-owner')$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'direct insert rejects NULL ownership before constraints');
insert into billing_boundary_results select 45, lives_ok(
  $$insert into public.restaurants (owner_id, organization_id, name, slug) values ('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Authorized insert', 'billing-boundary-authorized')$$,
  'admin retains direct insert with own identity and authorized organization');
insert into billing_boundary_results select 46, is(
  (select count(*)::integer from public.restaurants where slug = 'billing-boundary-authorized'),
  1, 'authorized direct insert actually persisted');
set local request.jwt.claims = '{"sub":"b1000000-0000-4000-8000-000000000001","role":"service_role"}';
insert into billing_boundary_results select 47, throws_ok(
  $$update public.restaurants set owner_id = 'b1000000-0000-4000-8000-000000000002' where slug = 'billing-boundary-authorized'$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'JWT role text cannot bypass effective SQL role guard');
insert into billing_boundary_results select 48, throws_ok(
  $$update public.restaurants set owner_id = null where slug = 'billing-boundary-authorized'$$,
  '42501', 'restaurant ownership and organization are backend-managed', 'ownership cannot be cleared to NULL');

reset role;
insert into billing_boundary_results select 49, ok(not exists (
  select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurants'
    and cmd in ('SELECT', 'ALL')
    and ('anon' = any(roles) or 'public' = any(roles))
), 'anonymous direct restaurant read policies are gone');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
insert into billing_boundary_results select 50, results_eq(
  $$select slug from public.get_public_restaurant_by_slug('billing-boundary-a')$$,
  $$values ('billing-boundary-a'::text)$$,
  'anonymous public slug RPC still returns the restaurant');
reset role;
-- Return each finish diagnostic separately; success emits no diagnostic rows.
with diagnostics as materialized (
  select result, ordinal from finish() with ordinality as completed(result, ordinal)
)
insert into billing_boundary_results
select 998 + ordinal::integer, result from diagnostics
union all
select 999, '# finish(): no failures' where not exists (select 1 from diagnostics);
select sequence, result from billing_boundary_results order by sequence;
rollback;
