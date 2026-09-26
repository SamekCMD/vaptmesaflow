-- Vapt business constraints added after the Better Auth schema baseline.
-- Product state is development-only, so each authenticated owner has exactly
-- one restaurant and no legacy tenant records are preserved.

begin;

create unique index if not exists restaurants_owner_id_unique
  on public.restaurants (owner_id);

commit;
