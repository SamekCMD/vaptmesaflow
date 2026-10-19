-- Read-only integrity checks, safe diagnostics without identities or billing secrets.
do $verify$
begin
  if to_regclass('public.organizations') is null or to_regclass('public.onboarding_intents') is null then
    raise exception 'Tenant foundation missing';
  end if;
  if exists (select 1 from public.restaurants r left join public.organizations o on o.id=r.organization_id
    left join public.organization_subscriptions s on s.organization_id=o.id where o.id is null or s.organization_id is null) then
    raise exception 'Tenant association or subscription missing';
  end if;
  if exists (select 1 from public.organizations o where not exists
    (select 1 from public.organization_members m where m.organization_id=o.id and m.role='owner' and m.status='active')) then
    raise exception 'Organization lacks an active owner';
  end if;
  if to_regclass('public.restaurants_owner_id_unique') is not null then
    raise exception 'Legacy owner-only constraint remains';
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgrelid='public.restaurants'::regclass
    and tgname='restaurants_organization_capacity' and tgenabled='O') then
    raise exception 'Organization capacity trigger missing';
  end if;
  if exists (select 1 from public.organization_subscriptions s where not exists
    (select 1 from public.organization_members m where m.organization_id=s.organization_id
      and m.user_id=s.billing_contact_user_id and m.status='active' and m.role in ('owner','admin'))) then
    raise exception 'Billing contact is not an active billing manager';
  end if;
end
$verify$;
