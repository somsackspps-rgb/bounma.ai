# Bounma AI v3.5.1 — Static review report

## Reviewed input
`Bounma_AI_v3_5_AUTH_optimized(1).zip` (34 files)

## Changes in this package
- Added `supabase_migrations/20261107_profile_edit_guard.sql` to allow a user to update only their own `full_name` and `avatar_url` while protecting account identity, email, role, status, and creation timestamp.
- Updated the fresh-install reference `supabase_setup.sql` so the signup trigger assigns only `student` or `teacher`, always with `pending` status. It no longer assigns Admin by matching an email address.
- Removed the email-based automatic Admin promotion statement from the fresh-install reference SQL. Initial Admin assignment must be a deliberate, reviewed Dashboard operation.
- Updated deployment instructions to warn existing deployments not to rerun the full setup SQL.
- Bumped the service worker cache version to 3.5.1.

## Findings not changed in this package
1. `profiles_select_classmates` permits classmates to read profile rows. Because the app has historically used nested profile reads for chat sender display, removing this policy before replacing that read path could break chat. A dedicated safe message/profile lookup migration is required.
2. Existing grants on `profiles` are broader than least-privilege. Tightening column privileges requires migrating admin/staff reads to controlled RPCs and testing every client query first.
3. The `delete-user` and `cleanup-files` Edge Functions need live deployment/configuration checks. Their presence in this ZIP does not prove they are deployed or have required secrets.
4. The app still depends on external CDN assets (Supabase JS, Tailwind CDN, fonts, PDF.js), so offline completeness and production performance need a separate pass.

## Verification performed
- JavaScript syntax check: `auth.js`, all `js/*.js`, `config.js`.
- Inline JavaScript syntax check: 2 non-empty inline script blocks extracted from `index.html`.
- ZIP structure inspected: 34 entries.

## Not verified
- No live browser test against the user's Supabase project.
- No SQL execution against the live Postgres database.
- No Edge Function deployment or secret verification.
- No real-time multi-user classroom test.

## Important deployment order
1. Back up the existing `guard_profile_update()` definition.
2. Review and run only `supabase_migrations/20261107_profile_edit_guard.sql` if profile-name editing is required.
3. Deploy the web files from this ZIP.
4. Perform the acceptance tests for profile edit, login/logout, registration, admin approval, classroom chat, and file upload.
5. Do not run the entire `supabase_setup.sql` against the existing production project.
