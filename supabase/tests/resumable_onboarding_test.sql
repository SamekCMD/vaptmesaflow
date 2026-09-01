begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;

create temporary table onboarding_tap_results (
  sequence integer not null,
  result text not null
) on commit drop;

insert into onboarding_tap_results values (0, plan(13));

insert into onboarding_tap_results values (1, has_column('public', 'restaurants', 'onboarding_status', 'onboarding status exists'));
insert into onboarding_tap_results values (2, has_column('public', 'restaurants', 'onboarding_step', 'onboarding step exists'));
insert into onboarding_tap_results values (3, has_column('public', 'restaurants', 'onboarding_updated_at', 'onboarding update timestamp exists'));
insert into onboarding_tap_results values (4, col_default_is('public', 'restaurants', 'onboarding_status', 'draft', 'new restaurants start as drafts'));
insert into onboarding_tap_results values (5, col_default_is('public', 'restaurants', 'onboarding_step', '0', 'new drafts start at step zero'));
insert into onboarding_tap_results values (6, has_function('public', 'save_onboarding_draft', array['text', 'text', 'integer', 'uuid', 'uuid', 'text', 'text', 'text', 'integer'], 'draft RPC exists'));
insert into onboarding_tap_results values (7, ok(has_function_privilege('authenticated', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)', 'execute'), 'authenticated users can save drafts'));
insert into onboarding_tap_results values (8, ok(not has_function_privilege('anon', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)', 'execute'), 'anonymous users cannot save drafts'));
insert into onboarding_tap_results values (9, ok(
  exists (
    select 1 from pg_proc
    where oid = 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer)'::regprocedure
      and prosecdef
  ),
  'draft RPC executes with its restricted definer privileges'
));
insert into onboarding_tap_results values (10, ok(
  (
    select count(*) = 2
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname in ('restaurants_onboarding_status_check', 'restaurants_onboarding_step_check')
  ),
  'onboarding status and step constraints exist'
));
insert into onboarding_tap_results values (11, has_function('public', 'save_onboarding_draft', array['text', 'text', 'integer', 'uuid', 'uuid', 'text', 'text', 'text', 'integer', 'boolean', 'boolean'], 'operation-aware draft RPC exists'));
insert into onboarding_tap_results values (12, ok(has_function_privilege('authenticated', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer,boolean,boolean)', 'execute'), 'authenticated users can save operation mode'));
insert into onboarding_tap_results values (13, ok(not has_function_privilege('anon', 'public.save_onboarding_draft(text,text,integer,uuid,uuid,text,text,text,integer,boolean,boolean)', 'execute'), 'anonymous users cannot save operation mode'));

insert into onboarding_tap_results
select 14, finish();

select sequence, result
from onboarding_tap_results
order by sequence;
rollback;
