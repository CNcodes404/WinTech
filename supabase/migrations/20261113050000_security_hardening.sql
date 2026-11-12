-- =============================================================================
-- Module 14: security review hardening (findings from supabase/scripts/security_posture.sql)
--   1. public.set_updated_at() was executable by anon/authenticated (default
--      privileges). Trigger functions cannot be invoked directly, so this was
--      harmless, but API roles should not hold EXECUTE on internal helpers.
--   2. profiles was the only table without an explicit delete guard. Deletion
--      was already impossible via the API (no grant) and blocked by foreign
--      keys once referenced; the guard makes it explicit for every role.
-- =============================================================================

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_no_delete
  before delete on public.profiles
  for each row execute function private.reject_delete();
