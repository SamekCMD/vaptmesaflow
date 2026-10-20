-- Read-only, aggregate verification. Does not expose emails, payloads or provider IDs.
select
  (select count(*) from public.organization_billing_legacy_resources legacy
    left join public.organization_billing_resources resource on resource.resource_id=legacy.resource_id
      and resource.resource_type=legacy.resource_type and resource.organization_id=legacy.organization_id
    where resource.resource_id is null) as missing_legacy_bindings,
  (select count(*) from public.billing_email_outbox where organization_id is null) as unscoped_outbox,
  (select count(*) from public.billing_email_outbox outbox join public.restaurants restaurant on restaurant.id=outbox.restaurant_id
    where restaurant.organization_id<>outbox.organization_id) as crossed_outbox_origins,
  (select count(*) from public.organization_subscriptions subscription
    left join public.organization_billing_resources customer on customer.resource_id=subscription.stripe_customer_id
      and customer.organization_id=subscription.organization_id and customer.resource_type='customer'
    left join public.organization_billing_resources plan on plan.resource_id=subscription.stripe_subscription_id
      and plan.organization_id=subscription.organization_id and plan.resource_type='subscription'
    where (subscription.stripe_customer_id is not null and customer.resource_id is null)
      or (subscription.stripe_subscription_id is not null and plan.resource_id is null)) as crossed_current_resources;
select routine.prosecdef as reconciliation_security_definer,
  routine.proconfig as reconciliation_fixed_search_path,
  not has_function_privilege('public',routine.oid,'execute') as no_public_reconciliation
from pg_catalog.pg_proc routine join pg_catalog.pg_namespace namespace on namespace.oid=routine.pronamespace
where namespace.nspname='public' and routine.proname='reconcile_organization_subscription';
