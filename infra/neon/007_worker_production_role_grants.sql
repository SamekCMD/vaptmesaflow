-- Apply ONLY on Neon project dawn-morning-27332079, branch production
-- br-odd-term-b6j2n9ms, database vapt, after creating vapt_api_production
-- through secure role management. Never include its password in this file.
begin;

do $guard$
begin
  if current_database() <> 'vapt' then
    raise exception 'Expected database vapt, got %', current_database();
  end if;
  if to_regrole('vapt_api_production') is null then
    raise exception 'Production-only role vapt_api_production is absent';
  end if;
  if exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'vapt_api_production'
      and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls)
  ) or exists (
    select 1 from pg_catalog.pg_auth_members
    where member = to_regrole('vapt_api_production')
  ) then
    raise exception 'Production role has unsafe attributes or inherited membership';
  end if;
end
$guard$;

grant connect on database vapt to vapt_api_production;
grant usage on schema public, better_auth to vapt_api_production;

grant select on
  public.restaurants, public.menu_items, public.menu_item_variations,
  public.table_sessions, public.orders, public.order_items, public.order_feedback,
  public.push_subscriptions, public.billing_provider_events,
  public.payment_provider_accounts, public.payment_transactions,
  public.payment_webhook_events, public.payment_oauth_states,
  better_auth."user", better_auth."session", better_auth."account", better_auth."verification"
to vapt_api_production;

grant insert on
  public.restaurants, public.menu_items, public.menu_item_variations,
  public.order_feedback, public.push_subscriptions, public.billing_provider_events,
  public.payment_provider_accounts, public.payment_transactions,
  public.payment_webhook_events, public.payment_oauth_states, public.billing_email_outbox,
  better_auth."user", better_auth."session", better_auth."account", better_auth."verification"
to vapt_api_production;

grant update on
  public.restaurants, public.menu_items, public.table_sessions, public.orders,
  public.order_feedback, public.push_subscriptions, public.billing_provider_events,
  public.payment_provider_accounts, public.payment_webhook_events,
  public.payment_oauth_states,
  better_auth."user", better_auth."session", better_auth."account", better_auth."verification"
to vapt_api_production;

grant delete on
  public.menu_items, public.menu_item_variations,
  better_auth."user", better_auth."session", better_auth."account", better_auth."verification"
to vapt_api_production;

grant execute on function
  public.create_public_order_v3(text, text, integer, jsonb, jsonb, text, text, text),
  public.apply_payment_transition_v2(uuid, integer, text, text, text, timestamptz, text, timestamptz, jsonb, text[]),
  public.claim_payment_effects(text, integer, timestamptz, timestamptz),
  public.complete_payment_effect(uuid, text, timestamptz),
  public.fail_payment_effect(uuid, text, text, integer, timestamptz, text),
  public.release_paid_order_to_production(uuid, uuid),
  public.count_pending_payment_effects()
to vapt_api_production;

commit;
