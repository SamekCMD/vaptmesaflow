-- Local rehearsal only; existing restricted preview role, no credentials or provisioning.
begin;
do $guard$
begin
  if current_database()<>'vapt' or to_regrole('vapt_api_preview') is null
    or to_regclass('public.organization_billing_resources') is null then
    raise exception 'Expected vapt, schema011 and existing preview API role';
  end if;
  if exists(select 1 from pg_catalog.pg_roles where rolname='vapt_api_preview'
    and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists(select 1 from pg_catalog.pg_auth_members where member=to_regrole('vapt_api_preview')) then
    raise exception 'preview API role is not restricted';
  end if;
end
$guard$;
revoke all on public.organization_billing_resources,public.organization_billing_legacy_resources from vapt_api_preview;
grant select on public.organization_billing_resources,public.organization_billing_legacy_resources to vapt_api_preview;
grant insert(resource_id,resource_type,organization_id) on public.organization_billing_resources to vapt_api_preview;
-- No direct entitlement, trial, billing-contact or organization reassignment.
grant update(stripe_customer_id,stripe_checkout_session_id,stripe_checkout_plan_type,stripe_checkout_expires_at)
  on public.organization_subscriptions to vapt_api_preview;
grant execute on function public.reconcile_organization_subscription(
  uuid,text,integer,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,timestamptz,text,text)
  to vapt_api_preview;
commit;
