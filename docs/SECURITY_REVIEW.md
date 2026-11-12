# Security review — V1 prototype (13 Nov 2026)

Scope: Supabase project **Wintech** (database, auth, Edge Function) and the React frontend.
Method: automated posture query, eight rollback-only test suites, Supabase security advisor, a live
end-to-end check with a real client login, frontend code review and dependency audit.

## Summary

No open high or medium findings. Two low-severity hygiene items were found and fixed
(migration `20261113050000_security_hardening.sql`). Remaining items are accepted by design or are
dashboard settings for the project owner.

## Evidence

| Check                                                | Result                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run test:db` — 8 suites, rollback-only, live DB | **167 / 167 checks pass**                                                              |
| `supabase/scripts/security_posture.sql`              | Clean (see table below)                                                                |
| Supabase security advisor                            | Only accepted findings (below)                                                         |
| Live E2E as demo client (real Auth API)              | Own profile only; portal data correct; direct table read → 0 rows; admin RPC → **403** |
| Anonymous REST access (publishable key only)         | `profiles` → **401**; RPCs not callable                                                |
| Edge Function probes                                 | No token / publishable key / forged JWT → **401**; foreign origin gets no CORS header  |
| `npm audit --omit=dev` (shipped code)                | 0 vulnerabilities                                                                      |
| Built bundle                                         | No `eval`/`new Function`, no inline scripts; only publishable key present              |

### Posture query (effective privileges)

| Check                                                  | Result                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Tables without RLS                                     | none                                                                                 |
| Anonymous access to any table/view                     | none                                                                                 |
| Direct INSERT/UPDATE/DELETE grants to signed-in users  | none                                                                                 |
| Column-level UPDATE for signed-in users                | `profiles.full_name`, `profiles.phone` (intended; RLS limits to own row, admins any) |
| SECURITY DEFINER functions without fixed `search_path` | none                                                                                 |
| Functions executable by anonymous users                | none (after fix)                                                                     |
| Private-schema functions executable by signed-in users | `is_admin` (required by RLS policies)                                                |
| Views not using `security_invoker`                     | none                                                                                 |
| Tables without a delete guard                          | none (after fix)                                                                     |
| Storage buckets                                        | 0 (receipt uploads deferred)                                                         |

## Controls in place

- **Authorization in the database.** RLS on every table; all writes go through SECURITY DEFINER
  functions that authorise first (`require_admin`, `current_client_id`). Frontend route guards are UX only.
- **No privilege escalation.** New users are always `client`; role/status/email columns are not
  grantable; role changes need an active admin, a reason, never self, never the last admin.
- **Client isolation.** Clients read only through `client_*` functions returning their own rows and
  client-safe columns (no admin notes/reasons/verifiers/holdings/other clients). Tested with two clients
  in a shared cycle and planted admin notes.
- **Financial integrity.** Ledger, NAV, valuation snapshots, fee accruals and audit log are append-only
  or immutable for every role including the table owner (triggers). Units issued exactly once (row lock +
  unique constraint). Decimal maths in Postgres `NUMERIC`; values travel as strings.
- **Auditability.** Every change writes an audit row in the same transaction (actor, before/after, reason).
- **Secrets.** Only the publishable key is in the browser; the app refuses to start with a secret or
  service-role key. The service-role key exists only inside the Edge Function runtime.
- **Auth.** Public sign-up disabled; PKCE flow; forced password change for admin-created accounts;
  password reset never reveals whether an account exists; open-redirect-safe return paths.
- **Browser hardening (Vercel).** Strict CSP (`script-src 'self'`, Supabase-only `connect-src`,
  `frame-ancestors 'none'`), `nosniff`, `X-Frame-Options: DENY`, strict referrer policy,
  permissions policy, `noindex`.
- **Exports.** CSV cells neutralised against spreadsheet formula injection.

## Findings and resolutions

| #   | Severity            | Finding                                                                                                           | Resolution                                                                                 |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | Low                 | `public.set_updated_at()` executable by anon/authenticated (default privileges). Not invocable outside a trigger. | Revoked (`20261113050000`).                                                                |
| 2   | Low                 | `profiles` had no explicit delete guard (already blocked by grants/FKs).                                          | Added `profiles_no_delete` trigger.                                                        |
| 3   | Info                | Advisor 0029: `admin_*`, `client_*`, `complete_password_change` executable by signed-in users.                    | Accepted by design — each authorises internally; covered by tests.                         |
| 4   | Owner action        | Leaked-password protection (HaveIBeenPwned) disabled.                                                             | Enable in Auth settings if the plan allows.                                                |
| 5   | Owner action        | Minimum password length in Supabase Auth.                                                                         | Set to 10 to match the app's policy.                                                       |
| 6   | Accepted            | Supabase session stored in `localStorage` (supabase-js default); exposed if XSS occurred.                         | Mitigated by strict CSP and React escaping; no `dangerouslySetInnerHTML` in the code base. |
| 7   | Accepted (dev-only) | `npm audit` moderate advisories in ESLint tooling (`minimatch`).                                                  | Not shipped to browsers.                                                                   |
| 8   | Accepted (V1)       | `must_change_password` is a UX guard; the server cannot verify the password actually changed.                     | Documented; real enforcement needs an Auth hook (future).                                  |

## Recommendations before any real-money use

These are outside a demo prototype's scope (see README legal boundary):
independent penetration test; legal/compliance review of the fund structure and fee model; custom SMTP
and email invites; MFA for administrators; backups/PITR and incident response plan; separate staging and
production projects; monitoring and alerting on audit events.
