-- =============================================================================
-- One-off bootstrap: promote an EXISTING auth user to admin.
--
-- API users cannot change roles (column privilege revoked), so this must be run
-- by the project owner via the Supabase CLI or SQL editor. Replace the email.
--
--   npx supabase db query --remote --yes -f supabase/scripts/promote_admin.sql
--
-- After the audit_logs table exists (Module 4), role changes are recorded there.
-- =============================================================================
update public.profiles
set role = 'admin', status = 'active'
where lower(email) = lower('REPLACE_WITH_ADMIN_EMAIL')
returning id, email, role, status;
