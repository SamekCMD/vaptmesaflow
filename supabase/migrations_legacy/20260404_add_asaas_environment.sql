alter table public.restaurants
  add column if not exists asaas_environment text not null default 'production';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurants_asaas_environment_check'
  ) then
    alter table public.restaurants
      add constraint restaurants_asaas_environment_check
      check (asaas_environment in ('production', 'sandbox'));
  end if;
end $$;

update public.restaurants
set asaas_environment = 'production'
where asaas_environment is null;
