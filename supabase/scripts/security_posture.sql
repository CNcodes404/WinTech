-- Read-only security posture check (uses has_*_privilege, which reflects real effective rights;
-- information_schema only lists grants visible to the querying role).
-- Expected: every row "none" / "false" / "0", except:
--   authenticated_column_updates      = profiles.full_name, profiles.phone (clients edit own contact; RLS)
--   authenticated_executable_private  = is_admin (needed by RLS policies)
-- Run: npx supabase db query --remote --read-only -f supabase/scripts/security_posture.sql
with tables as (
  select c.oid, c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
views as (
  select c.oid, c.relname, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
),
funcs as (
  select p.oid, n.nspname, p.proname, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
)
select 'tables_without_rls' as chk,
       coalesce((select string_agg(t.relname, ', ') from tables t join pg_class c on c.oid = t.oid where not c.relrowsecurity), 'none') as result
union all
select 'anon_table_or_view_access',
       coalesce((select string_agg(x.relname, ', ') from (select oid, relname from tables union all select oid, relname from views) x
                 where has_table_privilege('anon', x.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')), 'none')
union all
select 'authenticated_table_writes',
       coalesce((select string_agg(t.relname, ', ') from tables t
                 where has_table_privilege('authenticated', t.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')), 'none')
union all
select 'authenticated_column_updates',
       coalesce((select string_agg(t.relname || '.' || a.attname, ', ')
                   from tables t join pg_attribute a on a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped
                  where has_column_privilege('authenticated', t.oid, a.attname, 'UPDATE')), 'none')
union all
select 'secdef_without_search_path',
       coalesce((select string_agg(nspname || '.' || proname, ', ') from funcs
                 where prosecdef and not exists (select 1 from unnest(coalesce(proconfig, '{}')) cfg where cfg like 'search_path=%')), 'none')
union all
select 'anon_executable_functions',
       coalesce((select string_agg(nspname || '.' || proname, ', ') from funcs where has_function_privilege('anon', oid, 'EXECUTE')), 'none')
union all
select 'authenticated_executable_private',
       coalesce((select string_agg(proname, ', ') from funcs where nspname = 'private' and has_function_privilege('authenticated', oid, 'EXECUTE')), 'none')
union all
select 'views_without_security_invoker',
       coalesce((select string_agg(relname, ', ') from views
                 where not coalesce((select bool_or(o = 'security_invoker=true') from unnest(reloptions) o), false)), 'none')
union all
select 'tables_without_delete_guard',
       coalesce((select string_agg(t.relname, ', ') from tables t
                 where not exists (select 1 from pg_trigger tg where tg.tgrelid = t.oid and not tg.tgisinternal and (tg.tgtype & 8) <> 0)), 'none')
union all
select 'storage_buckets', (select count(*)::text from storage.buckets)
union all
select 'private_schema_usage_anon', has_schema_privilege('anon', 'private', 'USAGE')::text;
