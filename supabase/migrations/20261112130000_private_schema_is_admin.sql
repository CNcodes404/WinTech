-- =============================================================================
-- Module 3 hardening: move the role helper out of the API-exposed schema.
--
-- Supabase advisor 0029 flagged public.is_admin() as callable via /rest/v1/rpc.
-- RLS helpers belong in a schema PostgREST does not expose. Policies can still
-- call it because `authenticated` has USAGE on the schema and EXECUTE on it.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

comment on function private.is_admin() is
  'True when the calling user is an active admin. Use in RLS policies as (select private.is_admin()).';

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

alter policy profiles_select_admin on public.profiles
  using ((select private.is_admin()));

alter policy profiles_update_admin on public.profiles
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop function public.is_admin();
