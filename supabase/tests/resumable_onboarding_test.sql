begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

select plan(10);

select has_column('public', 'restaurants', 'onboarding_status', 'onboarding status exists');
select has_column('public', 'restaurants', 'onboarding_step', 'onboarding step exists');
select has_column('public', 'restaurants', 'onboarding_updated_at', 'onboarding update timestamp exists');
select col_default_is('public', 'restaurants', 'onboarding_status', '''draft''::text', 'new restaurants start as drafts');
select col_default_is('public', 'restaurants', 'onboarding_step', '0', 'new drafts start at step zero');
select has_function('public', 'save_onboarding_draft', array['text', 'text', 'integer', 'uuid', 'uuid', 'text', 'text', 'text', 'integer'], 'draft RPC exists');
select ok(has_function_privilege('authenticated', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)', 'execute'), 'authenticated users can save drafts');
select ok(not has_function_privilege('anon', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)', 'execute'), 'anonymous users cannot save drafts');
select ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)'::regprocedure
      and prosecdef
  ),
  'draft RPC executes with its restricted definer privileges'
);
select ok(
  (
    select count(*) = 2
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname in ('restaurants_onboarding_status_check', 'restaurants_onboarding_step_check')
  ),
  'onboarding status and step constraints exist'
);

select * from finish();
rollback;
