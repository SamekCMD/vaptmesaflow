begin;

create table public.restaurant_activation_progress (
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  module_key text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid default auth.uid()
    references auth.users(id) on delete set null,
  primary key (restaurant_id, module_key),
  constraint restaurant_activation_progress_module_key_check
    check (module_key in ('cashier', 'menu', 'kitchen', 'settings', 'overview'))
);

comment on table public.restaurant_activation_progress is
  'Immutable per-restaurant activation guide completions recorded after onboarding.';

create index restaurant_activation_progress_completed_by_idx
on public.restaurant_activation_progress (completed_by);

alter table public.restaurant_activation_progress enable row level security;

revoke all on table public.restaurant_activation_progress
from public, anon, authenticated;

grant select, insert on table public.restaurant_activation_progress
to authenticated;

create policy "restaurant_members_read_activation_progress"
on public.restaurant_activation_progress
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "restaurant_members_insert_activation_progress"
on public.restaurant_activation_progress
for insert
to authenticated
with check (
  public.is_restaurant_member(restaurant_id)
  and completed_by = auth.uid()
);

notify pgrst, 'reload schema';

commit;
