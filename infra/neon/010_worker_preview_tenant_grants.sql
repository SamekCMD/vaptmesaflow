-- Existing preview API role only; no credentials, membership provisioning or remote activation.
begin;
do $guard$
begin
  if current_database() <> 'vapt' or to_regrole('vapt_api_preview') is null then
    raise exception 'Expected vapt and existing preview API role';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname='vapt_api_preview'
    and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls))
    or exists (select 1 from pg_catalog.pg_auth_members where member=to_regrole('vapt_api_preview')) then
    raise exception 'preview API role is not restricted';
  end if;
end
$guard$;
revoke create on schema public from public,vapt_api_preview;
revoke all on public.organizations,public.organization_members,public.organization_subscriptions,
  public.account_preferences,public.restaurant_activation_progress,public.onboarding_intents from vapt_api_preview;
grant select on public.organizations,public.organization_members,public.organization_subscriptions,
  public.account_preferences,public.restaurant_activation_progress,public.onboarding_intents to vapt_api_preview;
grant insert,update on public.account_preferences to vapt_api_preview;
grant insert,update on public.restaurant_activation_progress to vapt_api_preview;
-- Initial organization/owner/restaurant provisioning must go through the narrow012 routines.
-- The old table-level grants would otherwise include new authoritative columns.
revoke insert,update on public.restaurants from vapt_api_preview;
grant update (name,slug,cnpj,whatsapp,address,phone,hours,description,primary_color,secondary_color,
  font_family,logo_url,total_tables,max_tables,payment_mode,max_pending_orders,local_enabled,delivery_enabled,
  asaas_api_key,asaas_billing_document,asaas_environment,asaas_setup_status,asaas_webhook_id,
  asaas_webhook_url,asaas_webhook_token,asaas_last_validated_at,asaas_last_error)
on public.restaurants to vapt_api_preview;
commit;
