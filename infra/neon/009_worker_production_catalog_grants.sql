-- Only project dawn-morning-27332079, production br-odd-term-b6j2n9ms, database vapt.
-- Requires separate production rollout gate; never creates credentials.
begin;
do $guard$
begin
  if current_database() <> 'vapt' or to_regrole('vapt_api_production') is null then
    raise exception 'Expected vapt and existing production API role';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'vapt_api_production'
    and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists (select 1 from pg_catalog.pg_auth_members where member = to_regrole('vapt_api_production')) then
    raise exception 'Production API role is not restricted';
  end if;
end
$guard$;
grant select, insert, delete on public.catalog_publication_operations to vapt_api_production;
grant select, insert, update on public.catalog_publication_revisions to vapt_api_production;
grant usage, select on sequence public.catalog_publication_version_seq to vapt_api_production;
commit;
