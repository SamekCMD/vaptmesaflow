-- Local rehearsal first. Requires the paired tenant-aware API before promotion.
begin;
do $guard$
begin
  if current_database()<>'vapt' or to_regclass('public.organization_billing_resources') is null then
    raise exception 'Expected vapt with schema011';
  end if;
end
$guard$;

create function public.assert_onboarding_session(p_user_id uuid,p_session_id uuid) returns void
language plpgsql set search_path=pg_catalog,public as $function$
begin
  perform session.id from better_auth."session" session join better_auth."user" identity on identity.id=session."userId"
    where session.id=p_session_id and session."userId"=p_user_id and session."expiresAt">clock_timestamp()
      and identity."emailVerified" for share of session,identity;
  if not found then raise exception using errcode='P0401',message='Verified live session required'; end if;
end
$function$;
revoke all on function public.assert_onboarding_session(uuid,uuid) from public;
create function public.assert_onboarding_basics(p_name text,p_slug text,p_whatsapp text) returns void
language plpgsql set search_path=pg_catalog,public as $function$
begin
  if p_name is null or length(btrim(p_name)) not between 2 and 80 or p_slug is null
    or length(p_slug) not between 2 and 60 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or (p_whatsapp is not null and length(p_whatsapp)>32) then
    raise exception using errcode='P0400',message='Invalid onboarding data';
  end if;
end
$function$;
revoke all on function public.assert_onboarding_basics(text,text,text) from public;

create function public.create_initial_restaurant_draft(p_user_id uuid,p_session_id uuid,p_operation_id uuid,
  p_name text,p_slug text,p_whatsapp text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $function$
declare previous public.onboarding_intents%rowtype; fingerprint_value text; organization uuid; restaurant uuid;
begin
  if p_operation_id is null or p_user_id is null or p_session_id is null then
    raise exception using errcode='P0400',message='Invalid onboarding request';
  end if;
  perform public.assert_onboarding_basics(p_name,p_slug,p_whatsapp);
  fingerprint_value:=encode(public.digest(convert_to(jsonb_build_array('initial_draft',p_user_id,btrim(p_name),p_slug,p_whatsapp)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('tenant:operation:'||p_operation_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('tenant:account:'||p_user_id::text,0));
  select * into previous from public.onboarding_intents where operation_id=p_operation_id;
  if found then
    if previous.actor_id<>p_user_id or previous.kind<>'initial_draft' or previous.fingerprint<>fingerprint_value then
      raise exception using errcode='P0409',message='Onboarding request conflicts';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('tenant:organization:'||previous.organization_id::text,0));
    perform 1 from public.organization_members where organization_id=previous.organization_id and user_id=p_user_id
      and status='active' and role in ('owner','admin');
    if not found then raise exception using errcode='42501',message='Forbidden'; end if;
    perform public.assert_onboarding_session(p_user_id,p_session_id);
    return previous.restaurant_id;
  end if;
  perform public.assert_onboarding_session(p_user_id,p_session_id);
  if exists(select 1 from public.organization_members where user_id=p_user_id and status='active'
    and role in ('owner','admin','manager','staff')) then
    raise exception using errcode='P0409',message='Use an existing organization';
  end if;
  organization:=gen_random_uuid();restaurant:=gen_random_uuid();
  perform pg_advisory_xact_lock(hashtextextended('tenant:organization:'||organization::text,0));
  perform pg_advisory_xact_lock(hashtextextended('tenant:slug:'||p_slug,0));
  insert into public.organizations(id,name,created_by) values(organization,btrim(p_name),p_user_id);
  insert into public.organization_members(organization_id,user_id,role,status) values(organization,p_user_id,'owner','active');
  insert into public.organization_subscriptions(organization_id,billing_contact_user_id) values(organization,p_user_id);
  insert into public.restaurants(id,organization_id,owner_id,name,slug,whatsapp)
    values(restaurant,organization,p_user_id,btrim(p_name),p_slug,p_whatsapp);
  insert into public.onboarding_intents(operation_id,actor_id,organization_id,restaurant_id,kind,fingerprint,result)
    values(p_operation_id,p_user_id,organization,restaurant,'initial_draft',fingerprint_value,jsonb_build_object('restaurantId',restaurant));
  insert into public.account_preferences(user_id,organization_id,restaurant_id) values(p_user_id,organization,restaurant)
    on conflict(user_id) do update set organization_id=excluded.organization_id,restaurant_id=excluded.restaurant_id;
  return restaurant;
end
$function$;
revoke all on function public.create_initial_restaurant_draft(uuid,uuid,uuid,text,text,text) from public;

create function public.create_organization_restaurant_draft(p_user_id uuid,p_session_id uuid,p_organization_id uuid,p_operation_id uuid,
  p_name text,p_slug text,p_whatsapp text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $function$
declare previous public.onboarding_intents%rowtype; fingerprint_value text; restaurant uuid;
begin
  if p_operation_id is null or p_user_id is null or p_session_id is null or p_organization_id is null then
    raise exception using errcode='P0400',message='Invalid onboarding request';
  end if;
  perform public.assert_onboarding_basics(p_name,p_slug,p_whatsapp);
  fingerprint_value:=encode(public.digest(convert_to(jsonb_build_array('organization_draft',p_user_id,p_organization_id,btrim(p_name),p_slug,p_whatsapp)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('tenant:operation:'||p_operation_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('tenant:organization:'||p_organization_id::text,0));
  perform 1 from public.organization_members where organization_id=p_organization_id and user_id=p_user_id
    and status='active' and role in ('owner','admin');
  if not found then raise exception using errcode='42501',message='Forbidden'; end if;
  perform public.assert_onboarding_session(p_user_id,p_session_id);
  select * into previous from public.onboarding_intents where operation_id=p_operation_id;
  if found then
    if previous.actor_id<>p_user_id or previous.organization_id<>p_organization_id or previous.kind<>'organization_draft'
      or previous.fingerprint<>fingerprint_value then
      raise exception using errcode='P0409',message='Onboarding request conflicts';
    end if;
    return previous.restaurant_id;
  end if;
  restaurant:=gen_random_uuid();
  perform pg_advisory_xact_lock(hashtextextended('tenant:slug:'||p_slug,0));
  insert into public.restaurants(id,organization_id,owner_id,name,slug,whatsapp)
    values(restaurant,p_organization_id,p_user_id,btrim(p_name),p_slug,p_whatsapp);
  insert into public.onboarding_intents(operation_id,actor_id,organization_id,restaurant_id,kind,fingerprint,result)
    values(p_operation_id,p_user_id,p_organization_id,restaurant,'organization_draft',fingerprint_value,jsonb_build_object('restaurantId',restaurant));
  insert into public.account_preferences(user_id,organization_id,restaurant_id) values(p_user_id,p_organization_id,restaurant)
    on conflict(user_id) do update set organization_id=excluded.organization_id,restaurant_id=excluded.restaurant_id;
  return restaurant;
end
$function$;
revoke all on function public.create_organization_restaurant_draft(uuid,uuid,uuid,uuid,text,text,text) from public;

create function public.finalize_restaurant_onboarding(p_user_id uuid,p_session_id uuid,p_restaurant_id uuid,p_operation_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $function$
declare previous public.onboarding_intents%rowtype; target public.restaurants%rowtype; fingerprint_value text; started_at timestamptz;
begin
  if p_operation_id is null or p_user_id is null or p_session_id is null or p_restaurant_id is null then
    raise exception using errcode='P0400',message='Invalid onboarding request';
  end if;
  fingerprint_value:=encode(public.digest(convert_to(jsonb_build_array('finalize',p_user_id,p_restaurant_id)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('tenant:operation:'||p_operation_id::text,0));
  select * into target from public.restaurants where id=p_restaurant_id;
  if not found then raise exception using errcode='42501',message='Forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended('tenant:organization:'||target.organization_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('tenant:restaurant:'||p_restaurant_id::text,0));
  perform 1 from public.organization_members where organization_id=target.organization_id and user_id=p_user_id
    and status='active' and role in ('owner','admin','manager');
  if not found then raise exception using errcode='42501',message='Forbidden'; end if;
  perform pg_advisory_xact_lock(hashtextextended('tenant:slug:'||target.slug,0));
  select * into target from public.restaurants where id=p_restaurant_id for update;
  perform public.assert_onboarding_session(p_user_id,p_session_id);
  select * into previous from public.onboarding_intents where operation_id=p_operation_id;
  if found then
    if previous.actor_id<>p_user_id or previous.restaurant_id<>p_restaurant_id or previous.kind<>'finalize'
      or previous.fingerprint<>fingerprint_value then
      raise exception using errcode='P0409',message='Onboarding request conflicts';
    end if;
    return p_restaurant_id;
  end if;
  if target.onboarding_status<>'complete' then
    perform public.assert_onboarding_basics(target.name,target.slug,target.whatsapp);
    if target.onboarding_step<>2 or (not target.local_enabled and not target.delivery_enabled)
      or target.total_tables not between 1 and 1000 then
      raise exception using errcode='P0400',message='Onboarding is incomplete';
    end if;
    started_at:=clock_timestamp();
    update public.organization_subscriptions set trial_started_at=started_at,trial_ends_at=started_at+interval '3 days'
      where organization_id=target.organization_id and plan_status='trialing' and trial_started_at is null;
  end if;
  insert into public.onboarding_intents(operation_id,actor_id,organization_id,restaurant_id,kind,fingerprint,result)
    values(p_operation_id,p_user_id,target.organization_id,p_restaurant_id,'finalize',fingerprint_value,jsonb_build_object('restaurantId',p_restaurant_id));
  if target.onboarding_status<>'complete' then
    -- Complete last. Any failure, including a constraint/trigger, rolls back trial and journal.
    update public.restaurants set max_tables=total_tables,onboarding_completed=true,onboarding_completed_at=started_at,
      onboarding_status='complete',onboarding_step=2,onboarding_updated_at=started_at where id=p_restaurant_id;
  end if;
  -- Never overwrite an account preference on a delayed finalization or replay.
  return p_restaurant_id;
end
$function$;
revoke all on function public.finalize_restaurant_onboarding(uuid,uuid,uuid,uuid) from public;
-- Hiding the GET is not enough: a guessed draft slug must not accept orders either.
create function public.require_complete_order_restaurant() returns trigger
language plpgsql set search_path=pg_catalog,public as $function$
begin
  perform 1 from public.restaurants where id=new.restaurant_id and onboarding_status='complete' for share;
  if not found then raise exception 'restaurant_not_found'; end if;
  return new;
end
$function$;
revoke all on function public.require_complete_order_restaurant() from public;
create trigger orders_complete_restaurant_required before insert on public.orders
  for each row execute function public.require_complete_order_restaurant();
commit;
