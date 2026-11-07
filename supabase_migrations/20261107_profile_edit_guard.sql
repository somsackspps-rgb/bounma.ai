-- Bounma AI v3.5.1: allow users to edit their own display name and avatar.
-- Scope: replaces ONE trigger function only. No rows, tables, policies,
-- triggers, Auth users, passwords, classroom records, or progress are changed.
-- Run this migration in Supabase SQL Editor after reviewing the function.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- A non-admin may update only their own full_name and avatar_url.
    -- Identity, email, role, status, and creation time remain protected.
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
        IF OLD.id IS DISTINCT FROM auth.uid()
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'only an admin can modify protected profile fields';
        END IF;
    END IF;

    -- Never allow removal/demotion of the final approved administrator.
    IF OLD.role = 'admin'
       AND OLD.status = 'approved'
       AND (NEW.role IS DISTINCT FROM 'admin'
            OR NEW.status IS DISTINCT FROM 'approved')
       AND NOT EXISTS (
           SELECT 1
           FROM public.profiles AS p
           WHERE p.id <> OLD.id
             AND p.role = 'admin'
             AND p.status = 'approved'
       ) THEN
        RAISE EXCEPTION 'cannot remove the last approved admin';
    END IF;

    NEW.id := OLD.id;
    RETURN NEW;
END;
$function$;

COMMIT;

-- Read-only verification after the migration:
-- SELECT pg_get_functiondef('public.guard_profile_update()'::regprocedure);
-- SELECT id, email, role, status FROM public.profiles
-- WHERE id = '03d85451-471c-41bd-8e82-7f4e5a7054f9';
