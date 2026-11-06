-- =====================================================================
-- Bounma AI : Supabase setup  (v3.2)
-- Run ONCE in Supabase Dashboard > SQL Editor > New query > Run.
-- Safe to re-run. It fixes: "approve user / change role does nothing".
--
-- ROOT CAUSES this script fixes
--  1. profiles had no `status` column (and the date column was named
--     create_at, the app expects created_at) -> approve could never work.
--  2. No RLS policy let an admin UPDATE other users' rows. Supabase then
--     silently updates 0 rows (no error), so the button looked broken.
--  3. Role/status were not protected: add server-side guards.
-- NOTE: existing users become 'pending' (except the first admin below).
--       Approve them from the Admin tab after running this.
-- =====================================================================

-- 1) profiles: columns ------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='create_at')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='created_at') then
    alter table public.profiles rename column create_at to created_at;
  end if;
end $$;

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists status text not null default 'pending';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

update public.profiles set role = 'student' where role is null or role not in ('admin','teacher','student');
update public.profiles set status = 'pending' where status is null or status not in ('pending','approved','rejected');

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','teacher','student'));
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('pending','approved','rejected'));

-- 2) progress table ---------------------------------------------------
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lessons jsonb not null default '[]'::jsonb,
  score int,
  best int,
  attempts int not null default 0,
  updated_at timestamptz not null default now()
);

-- 3) helper functions (SECURITY DEFINER avoids RLS recursion) ---------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','teacher') and status = 'approved');
$$;
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;
revoke all on function public.is_admin(), public.is_staff(), public.is_approved() from public;
grant execute on function public.is_admin(), public.is_staff(), public.is_approved() to authenticated;

-- 4) auto-create profile on sign-up (role whitelist: student/teacher) -
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r text := coalesce(new.raw_user_meta_data->>'role', 'student');
  first_admin boolean := lower(new.email) = 'somsack.spps@gmail.com';
begin
  if r not in ('student','teacher') then r := 'student'; end if;
  insert into public.profiles (id, full_name, email, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email,
          case when first_admin then 'admin' else r end,
          case when first_admin then 'approved' else 'pending' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) guard: only admins edit profiles; never remove the last admin ----
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'only an admin can modify profiles';
  end if;
  if old.role = 'admin' and old.status = 'approved' and (new.role <> 'admin' or new.status <> 'approved')
     and not exists (select 1 from public.profiles where id <> old.id and role = 'admin' and status = 'approved') then
    raise exception 'cannot remove the last approved admin';
  end if;
  new.id := old.id;
  return new;
end $$;
drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 6) Row Level Security (drops old policies, then recreates) ----------
alter table public.profiles enable row level security;
alter table public.progress enable row level security;

do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('profiles','progress') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy profiles_select_own   on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_select_staff on public.profiles for select to authenticated
  using (public.is_staff() and role = 'student' and status = 'approved');
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy progress_select_own   on public.progress for select to authenticated using (user_id = auth.uid() and public.is_approved());
create policy progress_insert_own   on public.progress for insert to authenticated with check (user_id = auth.uid() and public.is_approved());
create policy progress_update_own   on public.progress for update to authenticated
  using (user_id = auth.uid() and public.is_approved()) with check (user_id = auth.uid() and public.is_approved());
create policy progress_select_staff on public.progress for select to authenticated using (public.is_staff());

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.progress to authenticated;

-- 7) backfill + first admin -------------------------------------------
insert into public.profiles (id, full_name, email, role, status)
select u.id, coalesce(u.raw_user_meta_data->>'full_name',''), u.email, 'student', 'pending'
from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
update public.profiles set role = 'admin', status = 'approved' where lower(email) = 'somsack.spps@gmail.com';

-- 8) check result -----------------------------------------------------
select email, role, status, created_at from public.profiles order by created_at;


-- =====================================================================
-- Bounma AI v3.3: Classrooms, group chat, notifications and attachments
-- Safe to run after the v3.2 setup above. Does not delete existing data.
-- =====================================================================

alter table public.profiles add column if not exists avatar_url text;

create table if not exists public.classroom_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.classroom_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id,user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.classroom_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  message_type text not null default 'text' check (message_type in ('text','announcement','image','pdf')),
  attachment_path text,
  created_at timestamptz not null default now(),
  constraint group_messages_content_check check (
    char_length(body) <= 4000 and
    (char_length(body) > 0 or attachment_path is not null)
  )
);

create index if not exists group_members_user_idx on public.group_members(user_id);
create index if not exists group_messages_group_created_idx on public.group_messages(group_id,created_at);

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.group_members gm where gm.group_id=p_group and gm.user_id=auth.uid());
$$;

create or replace function public.is_group_teacher(p_group uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.classroom_groups g
    where g.id=p_group and (
      g.created_by=auth.uid() or public.is_admin() or
      (public.is_group_member(p_group) and exists(
        select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.status='approved'
      ))
    )
  );
$$;

create or replace function public.can_view_group_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select p_profile=auth.uid() or exists(
    select 1 from public.group_members mine
    join public.group_members theirs on theirs.group_id=mine.group_id
    where mine.user_id=auth.uid() and theirs.user_id=p_profile
  );
$$;

revoke all on function public.is_group_member(uuid), public.is_group_teacher(uuid), public.can_view_group_profile(uuid) from public;
grant execute on function public.is_group_member(uuid), public.is_group_teacher(uuid), public.can_view_group_profile(uuid) to authenticated;

create or replace function public.add_group_creator_as_member()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.group_members(group_id,user_id) values(new.id,new.created_by)
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists classroom_group_add_creator on public.classroom_groups;
create trigger classroom_group_add_creator after insert on public.classroom_groups
for each row execute function public.add_group_creator_as_member();

create or replace function public.join_classroom_by_code(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_group uuid;
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'approved account required';
  end if;
  select id into v_group from public.classroom_groups where upper(join_code)=upper(trim(p_code));
  if v_group is null then raise exception 'invalid classroom code'; end if;
  insert into public.group_members(group_id,user_id) values(v_group,auth.uid())
  on conflict do nothing;
  return v_group;
end $$;
revoke all on function public.join_classroom_by_code(text) from public;
grant execute on function public.join_classroom_by_code(text) to authenticated;

alter table public.classroom_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists classroom_groups_select_member on public.classroom_groups;
drop policy if exists classroom_groups_insert_teacher on public.classroom_groups;
drop policy if exists classroom_groups_update_owner on public.classroom_groups;
drop policy if exists classroom_groups_delete_owner on public.classroom_groups;
create policy classroom_groups_select_member on public.classroom_groups for select to authenticated
using (public.is_group_member(id) or created_by=auth.uid() or public.is_admin());
create policy classroom_groups_insert_teacher on public.classroom_groups for insert to authenticated
with check (created_by=auth.uid() and public.is_approved() and exists(
  select 1 from public.profiles p where p.id=auth.uid() and p.role in ('teacher','admin')
));
create policy classroom_groups_update_owner on public.classroom_groups for update to authenticated
using (created_by=auth.uid() or public.is_admin()) with check (created_by=auth.uid() or public.is_admin());
create policy classroom_groups_delete_owner on public.classroom_groups for delete to authenticated
using (created_by=auth.uid() or public.is_admin());

drop policy if exists group_members_select_group on public.group_members;
drop policy if exists group_members_select_self on public.group_members;
create policy group_members_select_group on public.group_members for select to authenticated
using (public.is_group_member(group_id) or public.is_group_teacher(group_id));
create policy group_members_select_self on public.group_members for select to authenticated
using (user_id=auth.uid());

drop policy if exists group_messages_select_member on public.group_messages;
drop policy if exists group_messages_insert_member on public.group_messages;
create policy group_messages_select_member on public.group_messages for select to authenticated
using (public.is_group_member(group_id) or public.is_group_teacher(group_id));
create policy group_messages_insert_member on public.group_messages for insert to authenticated
with check (
  sender_id=auth.uid() and public.is_approved() and
  (public.is_group_member(group_id) or public.is_group_teacher(group_id)) and
  (message_type <> 'announcement' or public.is_group_teacher(group_id))
);

drop policy if exists profiles_select_classmates on public.profiles;
create policy profiles_select_classmates on public.profiles for select to authenticated
using (public.can_view_group_profile(id));

grant select, insert, update, delete on public.classroom_groups to authenticated;
grant select, insert on public.group_members to authenticated;
grant select, insert on public.group_messages to authenticated;

-- Private bucket for classroom attachments (10 MB limit enforced in client).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('classroom-files','classroom-files',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','application/pdf'];

drop policy if exists classroom_files_upload_member on storage.objects;
drop policy if exists classroom_files_read_member on storage.objects;
create policy classroom_files_upload_member on storage.objects for insert to authenticated
with check (
  bucket_id='classroom-files' and
  (public.is_group_member(((storage.foldername(name))[1])::uuid) or public.is_group_teacher(((storage.foldername(name))[1])::uuid))
);
create policy classroom_files_read_member on storage.objects for select to authenticated
using (
  bucket_id='classroom-files' and
  (public.is_group_member(((storage.foldername(name))[1])::uuid) or public.is_group_teacher(((storage.foldername(name))[1])::uuid))
);

-- Enable Realtime for group chat without failing if already included.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
exception when undefined_object then
  raise notice 'supabase_realtime publication not found; enable Realtime for group_messages in Supabase Dashboard.';
end $$;

select 'Classroom setup complete' as result;


-- Allow users to update only their own avatar URL; role/status remain admin-only.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if old.id <> auth.uid()
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.full_name is distinct from old.full_name
       or new.created_at is distinct from old.created_at then
      raise exception 'only an admin can modify profile fields other than own avatar';
    end if;
  end if;
  if old.role = 'admin' and old.status = 'approved' and (new.role <> 'admin' or new.status <> 'approved')
     and not exists (select 1 from public.profiles where id <> old.id and role = 'admin' and status = 'approved') then
    raise exception 'cannot remove the last approved admin';
  end if;
  new.id := old.id;
  return new;
end $$;

drop policy if exists profiles_update_own_avatar on public.profiles;
create policy profiles_update_own_avatar on public.profiles for update to authenticated
using (id=auth.uid()) with check (id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-avatars','profile-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists profile_avatars_upload_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_upload_own on storage.objects for insert to authenticated
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_avatars_update_own on storage.objects for update to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy profile_avatars_delete_own on storage.objects for delete to authenticated
using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);


-- =====================================================================
-- Bounma AI v3.4: classroom upgrades (safe to re-run; does not delete data)
--   * attachments stay on the user's device -> new message types 'file' / 'link'
--   * list members, remove members (teacher->students, admin->teachers)
--   * teachers/owners may only rename a room (name + description), nothing else
-- =====================================================================

-- 1) message types: 'file' = note that points to a file kept on the sender's device, 'link' = https link
alter table public.group_messages drop constraint if exists group_messages_message_type_check;
alter table public.group_messages add constraint group_messages_message_type_check
  check (message_type in ('text','announcement','image','pdf','file','link'));
alter table public.group_messages drop constraint if exists group_messages_attachment_shape_check;
alter table public.group_messages add constraint group_messages_attachment_shape_check check (
  (message_type = 'link' and attachment_path ~ '^https://[^[:space:]]+$' and char_length(attachment_path) <= 500)
  or (message_type = 'file' and attachment_path ~ '^local:' and char_length(attachment_path) <= 400)
  or message_type not in ('link','file')
);

-- 2) a room owner (non-admin) can change only name/description
create or replace function public.guard_group_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id or new.created_by is distinct from old.created_by
       or new.join_code is distinct from old.join_code or new.created_at is distinct from old.created_at then
      raise exception 'only the name and description of a classroom can be changed';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_group_update on public.classroom_groups;
create trigger guard_group_update before update on public.classroom_groups
  for each row execute function public.guard_group_update();

-- 3) list members (email is returned to teachers/admins only)
create or replace function public.list_group_members(p_group uuid)
returns table(user_id uuid, full_name text, role text, avatar_url text, email text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'approved account required'; end if;
  if not (public.is_group_member(p_group) or public.is_group_teacher(p_group)) then
    raise exception 'not a member of this classroom';
  end if;
  return query
    select gm.user_id, p.full_name, p.role, p.avatar_url,
           case when public.is_staff() then p.email else null end, gm.joined_at
    from public.group_members gm join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group
    order by gm.joined_at;
end $$;
revoke all on function public.list_group_members(uuid) from public;
grant execute on function public.list_group_members(uuid) to authenticated;

-- 4) remove a member: teacher/admin of the room -> students ; admin only -> teachers/admins
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_owner uuid;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'approved account required'; end if;
  if p_user = auth.uid() then raise exception 'you cannot remove yourself'; end if;
  if not public.is_group_teacher(p_group) then raise exception 'only a teacher or admin of this classroom can remove members'; end if;
  select pr.role into v_role from public.profiles pr where pr.id = p_user;
  if v_role is null then raise exception 'user not found'; end if;
  if v_role <> 'student' and not public.is_admin() then raise exception 'only an admin can remove a teacher'; end if;
  if not exists (select 1 from public.group_members g where g.group_id = p_group and g.user_id = p_user) then
    raise exception 'user is not a member of this classroom';
  end if;
  delete from public.group_members g where g.group_id = p_group and g.user_id = p_user;
  select c.created_by into v_owner from public.classroom_groups c where c.id = p_group;
  if p_user = v_owner then  -- removed the owner: the admin becomes owner so the room is never orphaned
    update public.classroom_groups set created_by = auth.uid() where id = p_group;
    insert into public.group_members(group_id, user_id) values (p_group, auth.uid()) on conflict do nothing;
  end if;
end $$;
revoke all on function public.remove_group_member(uuid, uuid) from public;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

select 'v3.4 classroom upgrade complete' as result;
