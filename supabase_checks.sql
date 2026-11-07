-- Run in Supabase SQL Editor to verify v3.4 is installed correctly (read-only)
select 'functions' as what, proname from pg_proc where proname in ('list_group_members','remove_group_member','guard_group_update','join_classroom_by_code') order by 2;
select 'triggers' as what, tgname from pg_trigger where tgname in ('guard_group_update','guard_profile_update') and not tgisinternal;
select 'constraints' as what, conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.group_messages'::regclass and contype='c';
select 'policies' as what, tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('classroom_groups','group_members','group_messages','profiles') order by 2,3;

-- v3.5
select 'v3.5 functions' as what, proname from pg_proc where proname in ('bounma_limits','room_storage_usage','mark_room_file_deleted','admin_storage_summary','room_files_guard','group_messages_guard') order by 2;
select 'v3.5 limits' as what, * from public.bounma_limits();
select 'v3.5 triggers' as what, tgname from pg_trigger where tgname in ('room_files_guard','group_messages_guard') and not tgisinternal;
select 'v3.5 storage policies' as what, policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'classroom_files_%' order by 2;
select 'v3.5 bucket' as what, id, file_size_limit, allowed_mime_types from storage.buckets where id='classroom-files';
