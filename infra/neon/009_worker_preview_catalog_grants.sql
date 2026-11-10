-- Only project dawn-morning-27332079, preview br-rough-dew-b6ydeygb, database vapt.
-- Does not create credentials or change production. Verify remote identity first.
begin;
do $guard$
begin
  if current_database() <> 'vapt' or to_regrole('vapt_api_preview') is null then
    raise exception 'Expected vapt and existing preview API role';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'vapt_api_preview'
    and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists (select 1 from pg_catalog.pg_auth_members where member = to_regrole('vapt_api_preview')) then
    raise exception 'Preview API role is not restricted';
  end if;
end
$guard$;
grant select, insert, delete on public.catalog_publication_operations to vapt_api_preview;
grant select, insert, update on public.catalog_publication_revisions to vapt_api_preview;
grant usage, select on sequence public.catalog_publication_version_seq to vapt_api_preview;
commit;
