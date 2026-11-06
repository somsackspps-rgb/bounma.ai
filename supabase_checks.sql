-- Run in Supabase SQL Editor to verify v3.4 is installed correctly (read-only)
select 'functions' as what, proname from pg_proc where proname in ('list_group_members','remove_group_member','guard_group_update','join_classroom_by_code') order by 2;
select 'triggers' as what, tgname from pg_trigger where tgname in ('guard_group_update','guard_profile_update') and not tgisinternal;
select 'constraints' as what, conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.group_messages'::regclass and contype='c';
select 'policies' as what, tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('classroom_groups','group_members','group_messages','profiles') order by 2,3;
