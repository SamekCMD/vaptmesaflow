-- Only dawn-morning-27332079 / br-odd-term-b6j2n9ms / vapt.
-- Apply only after the preview Hyperdrive cancellation/rollback gate passes.
-- No owner/billing settings, grants, schema or passwords are changed.
begin;
do $guard$
begin
  if current_database() <> 'vapt' or current_user <> 'neondb_owner' then
    raise exception 'Expected vapt database and migration owner';
  end if;
  if to_regrole('vapt_api_production') is null or exists (
    select 1 from pg_catalog.pg_roles where rolname = 'vapt_api_production'
      and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
  ) or exists (
    select 1 from pg_catalog.pg_auth_members where member = to_regrole('vapt_api_production')
  ) then
    raise exception 'Missing or unsafe production API role';
  end if;
end
$guard$;
alter role vapt_api_production in database vapt set statement_timeout = '8s';
alter role vapt_api_production in database vapt set lock_timeout = '2s';
commit;
-- Recovery of this first application (operator must first verify prior keys absent):
-- ALTER ROLE vapt_api_production IN DATABASE vapt RESET statement_timeout;
-- ALTER ROLE vapt_api_production IN DATABASE vapt RESET lock_timeout;
-- Recycle ONLY this role's Hyperdrive pool to apply changed login defaults.
