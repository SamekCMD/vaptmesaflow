-- Existing restricted role only. Local rehearsal before a coordinated rollout.
begin;
do $guard$
begin
  if current_database()<>'vapt' or to_regrole('vapt_api_production') is null
    or to_regprocedure('public.finalize_restaurant_onboarding(uuid,uuid,uuid,uuid)') is null then
    raise exception 'Expected vapt, schema012 and existing production API role';
  end if;
  if exists(select 1 from pg_catalog.pg_roles where rolname='vapt_api_production'
    and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists(select 1 from pg_catalog.pg_auth_members where member=to_regrole('vapt_api_production')) then
    raise exception 'production API role is not restricted';
  end if;
end
$guard$;
grant execute on function
  public.create_initial_restaurant_draft(uuid,uuid,uuid,text,text,text),
  public.create_organization_restaurant_draft(uuid,uuid,uuid,uuid,text,text,text),
  public.finalize_restaurant_onboarding(uuid,uuid,uuid,uuid)
to vapt_api_production;
-- Draft step is writable; completion and trial remain behind the finalization routine.
grant update(onboarding_step,onboarding_updated_at) on public.restaurants to vapt_api_production;
commit;
