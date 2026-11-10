-- Apply on the existing preview first, then production only after the rollout gate.
-- No trigger, recurring job, role, database, or extension is created here.
begin;

do $guard$
begin
  if current_database() <> 'vapt' and current_database() !~ '^vapt_catalog_test_[a-z0-9_]+$' then
    raise exception 'Expected vapt or an explicitly isolated local catalog test database';
  end if;
  if to_regclass('public.restaurants') is null or to_regclass('better_auth.session') is null then
    raise exception 'Business and Better Auth baselines must exist first';
  end if;
end
$guard$;

create sequence public.catalog_publication_version_seq as bigint minvalue 1 no cycle;

create table public.catalog_publication_revisions (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  version bigint not null unique check (version > 0)
);

create table public.catalog_publication_operations (
  operation_id uuid primary key,
  actor_id uuid not null,
  restaurant_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  version bigint not null unique check (version > 0),
  snapshot jsonb not null,
  result jsonb not null,
  previous_slug text,
  committed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  unique (actor_id, operation_id),
  check (expires_at > committed_at),
  check (jsonb_typeof(snapshot) = 'object'),
  check (((snapshot ->> 'version')::bigint = version) is true),
  check (((snapshot -> 'catalog' -> 'restaurant' ->> 'id')::uuid = restaurant_id) is true)
);

create index catalog_publication_operations_expiry_idx on public.catalog_publication_operations(expires_at);
revoke all on public.catalog_publication_operations, public.catalog_publication_revisions from public;
revoke all on sequence public.catalog_publication_version_seq from public;

-- Logical idempotency expires after seven days. Physical cleanup is bounded,
-- opportunistic work in real mutations, never a timer that wakes an idle database.
commit;
