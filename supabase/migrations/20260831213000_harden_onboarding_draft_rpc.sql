revoke all on function public.save_onboarding_draft(text, text, integer, uuid, uuid, text, text, text, integer)
  from anon;

-- These SECURITY DEFINER helpers are internal implementation details. Supabase
-- installations may grant function execution directly through default ACLs.
revoke all on function public.get_or_create_default_owner_organization(uuid, text, timestamptz)
  from anon, authenticated;

revoke all on function public.sync_restaurant_onboarding_state()
  from anon, authenticated;

