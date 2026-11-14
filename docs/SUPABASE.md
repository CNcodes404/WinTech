# Supabase operations

Project: **Wintech** (`lqgdodaloqedzyhcjkwn`). The CLI is run through `npx supabase` (no global install).

## One-time setup (per machine)

```bash
npx supabase login                                   # opens browser
npx supabase link --project-ref lqgdodaloqedzyhcjkwn # run from the repo root
```

Credentials are stored by the CLI on the machine — never in the repo or chat.

## Schema changes

All schema changes are SQL migrations in `supabase/migrations/` (never edit the schema in the dashboard).

```bash
npx supabase migration list --remote          # what is applied
npx supabase db push --remote                 # apply new migrations (asks for confirmation)
npx supabase gen types typescript --remote --schema public > src/lib/supabase/database.types.ts
```

## Security tests (RLS)

Each test file runs inside one `DO` block that always ends with an exception, so **every change is
rolled back** — safe against the live project.

```bash
npx supabase db query --remote -f supabase/tests/rls_profiles.test.sql
# Expected: ERROR ... ALL_PROFILE_RLS_TESTS_PASSED (21 checks)
npx supabase db query --remote -f supabase/tests/rls_audit.test.sql
# Expected: ERROR ... ALL_AUDIT_TESTS_PASSED (22 checks)
npx supabase db query --remote -f supabase/tests/cycles.test.sql
# Expected: ERROR ... ALL_CYCLE_TESTS_PASSED (37 checks)
npx supabase db query --remote -f supabase/tests/contributions.test.sql
# Expected: ERROR ... ALL_CONTRIBUTION_TESTS_PASSED (24 checks)
npx supabase db query --remote -f supabase/tests/valuations.test.sql
# Expected: ERROR ... ALL_VALUATION_TESTS_PASSED (23 checks)
npx supabase db query --remote -f supabase/tests/nav.test.sql
# Expected: ERROR ... ALL_NAV_TESTS_PASSED (19 checks)
npx supabase db query --remote -f supabase/tests/fees.test.sql
# Expected: ERROR ... ALL_FEE_TESTS_PASSED (13 checks)
npx supabase db query --remote -f supabase/tests/client_portal.test.sql
# Expected: ERROR ... ALL_CLIENT_PORTAL_TESTS_PASSED (13 checks)
npx supabase db query --remote -f supabase/tests/reset.test.sql
# Expected: ERROR ... ALL_RESET_TESTS_PASSED (9 checks)
npx supabase db advisors --remote --type security
```

Run all suites (PowerShell):

```powershell
foreach ($t in 'rls_profiles','rls_audit','cycles','contributions','valuations','nav','fees','client_portal','reset') {
  npx supabase db query --remote -f "supabase/tests/$t.test.sql"
}
```

### Accepted advisor findings

| Finding                                                       | Why it is accepted                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0029 `admin_*` functions executable by signed-in users        | Intentional admin API. Every `admin_*` function calls `private.require_admin()` / `private.is_admin()` first and rejects everyone else (covered by every test suite).                       |
| 0029 `client_*` functions executable by signed-in users       | Intentional client API. Each calls `private.current_client_id()` (active client only) and returns only the caller's own rows and client-safe columns (`client_portal.test.sql`).            |
| 0029 `admin_reset_demo_data` executable by signed-in users    | Demo-only reset. Requires an active admin, the typed phrase and a reason, and refuses to run when `private.app_config.demo_reset_enabled` is false (`reset.test.sql`). Never deletes users. |
| 0029 `complete_password_change` executable by signed-in users | Only clears the caller's own `must_change_password` flag.                                                                                                                                   |
| Leaked password protection disabled                           | Dashboard setting; enable if the plan supports it.                                                                                                                                          |

## Edge Functions

```bash
npx supabase functions deploy admin-create-client --use-api --no-verify-jwt
```

- `admin-create-client` verifies the caller's access token itself and requires an active admin.
- The service-role key is provided to Edge Functions automatically by Supabase — no secret to set.
- CORS allows `http://localhost:5173` by default. For a deployed frontend set
  `npx supabase secrets set ALLOWED_ORIGINS=https://your-domain` (comma-separated).
- V1 creates accounts with an admin-chosen temporary password (no invite email; the default Supabase mailer
  only delivers to project team addresses).

## Admin accounts

- Public sign-up is **disabled**. New users get the `client` role automatically (trigger); the role is
  never taken from user-supplied metadata.
- Role/status/email columns cannot be updated through the API, even by admins. Promote the first admin with
  `supabase/scripts/promote_admin.sql` (edit the email first). Audited admin-management functions arrive in
  Modules 4–5.
- The last active admin cannot be demoted or deactivated (database trigger).
- Users with a profile cannot be deleted (`ON DELETE RESTRICT`) — deactivate them instead to keep the audit trail.

## Dashboard settings checklist

| Setting                                                 | Value                                  | Status                          |
| ------------------------------------------------------- | -------------------------------------- | ------------------------------- |
| Auth → Sign In / Providers → Allow new users to sign up | **Off**                                | ✅                              |
| Auth → URL Configuration → Site URL                     | `http://localhost:5173`                | ✅                              |
| Auth → URL Configuration → Redirect URLs                | `http://localhost:5173/reset-password` | ⬜                              |
| Auth → Providers → Email → Minimum password length      | 10                                     | ⬜ recommended                  |
| Auth → Leaked password protection (HaveIBeenPwned)      | On                                     | ⬜ recommended (plan-dependent) |

## Keys

- Browser: project URL + **publishable** key only (`.env.local`, git-ignored). The app refuses to start with
  an `sb_secret_…` or service-role key.
- Secret/service-role key: only in Edge Function secrets (Module 4). Never in `VITE_*` variables.
