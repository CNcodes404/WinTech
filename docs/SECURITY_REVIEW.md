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
| `npm run test:db` — 9 suites, rollback-only, live DB | **181 / 181 checks pass**                                                              |
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

## Addendum — admin data reset (14 Nov 2026)

Migration `20261114010000_admin_data_reset.sql` adds `admin_reset_demo_data`, the only path that deletes
financial or audit records. Controls: active admin only (`require_admin`), exact phrase `ERASE ALL DATA`,
mandatory reason, server-side kill switch `private.app_config.demo_reset_enabled` (not reachable through the
API), atomic execution (guards disabled and re-enabled in the same transaction; verified none left disabled),
users and account history never touched, and a `maintenance.data_reset` audit entry with counts.
**Risk accepted for the demo; set the switch to false before any real use** (see `docs/DEPLOYMENT.md`).

## Addendum — Module 15 fee model (14 Nov 2026)

Migration `20261115010000_fund_level_fees.sql`. The client API was rebuilt so that **no client function
returns performance-fee data**: `client_my_cycles`, `client_my_contributions`, `client_nav_history` and
`client_my_activity` return only the NAV after the fee, value, profit, admin fee and final profit; the
per-lot `client_my_lot_values` was removed. `client_portal.test.sql` checks the result columns of every
`client_*` function against a deny-list (performance, fee rate/amount, gross, HWM), and the frontend tests
assert the words never appear in the portal. The new admin view `client_position_report` is
`security_invoker` (admin-only through base-table RLS); `admin_set_admin_fee` is admin-only, validated and
audited (`cycle.admin_fee_changed`). The security posture check is unchanged (clean).
