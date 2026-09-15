-- RLS already filters anonymous rows, but billing tables should not be queryable
-- by anonymous clients at all.
revoke all privileges on table public.organization_subscriptions from public, anon;
