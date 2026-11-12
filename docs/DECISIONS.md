# Decisions Log

Approved by the product owner on 12 Nov 2026 (Module 0 plan review). All accounting rules below are a
**demo-only model** and require professional review before any production use.

| ID  | Decision                                                                                                                                                                                                                                                                                                       | Applies in   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| A   | **Per-lot fee model.** Gross NAV is computed for the whole cycle. Performance fee is accrued per contribution lot in `lot_fee_accruals` (lot HWM, loss carry-forward, eligible profit, fee, net value). Snapshot fee total = sum of lot accruals. Any "net NAV per unit" shown is a labelled weighted average. | Modules 9–10 |
| B   | **Unit issuance NAV.** Units are issued at the latest _published gross NAV_ as of the contribution's `received_at`; if none exists, the cycle's `base_nav`. That NAV becomes the lot's starting HWM, so later entrants are not charged for earlier gains.                                                      | Module 7     |
| C   | **Fee-rate versioning.** Rates live in a versioned, effective-dated `cycle_fee_terms` table. Each lot locks the rate in force when it is issued; later changes apply only to lots issued after the effective date.                                                                                             | Modules 6–7  |
| D   | **Crystallisation.** V1 accrues fees only (indicative). Crystallisation is an informational event at cycle close; no money moves.                                                                                                                                                                              | Module 10    |
| E   | **Stale valuation guard.** NAV calculation warns/blocks when units were verified after the valuation timestamp; a fresh valuation must be recorded first.                                                                                                                                                      | Module 9     |
| F   | **Rounding policy.** See [ROUNDING_POLICY.md](ROUNDING_POLICY.md).                                                                                                                                                                                                                                             | All          |
| G   | **Account provisioning.** Public sign-up is disabled. First admin is bootstrapped via SQL; clients are created by an admin through an Edge Function that holds the service-role key server-side.                                                                                                               | Modules 3–4  |
| H   | **Module order.** Schema is introduced per feature module; Admin Overview moved after the NAV/fee modules so it uses real seeded data.                                                                                                                                                                         | Plan         |
| I   | **Supabase environment.** Use the product owner's hosted Supabase project.                                                                                                                                                                                                                                     | Module 3     |

## Module 4 engineering choices

- **Audit log is append-only** — UPDATE/DELETE/TRUNCATE are blocked by triggers for every role, API users
  cannot INSERT, and only admins can read it. Rows are written in the same transaction as the change.
- **Every profile change is audited** by trigger (before/after of changed fields, actor, optional reason).
- **Role/status changes** only through `admin_set_user_role` / `admin_set_user_status` (active admin, mandatory
  reason ≥ 5 chars, cannot change own role/status). Last-admin protection still applies.
- **Client accounts** are created by the `admin-create-client` Edge Function with an admin-chosen **temporary
  password** (V1). Email invites need custom SMTP — deferred. Forced password change on first login is not
  yet implemented (noted for Module 12/14).
- **Route guards** (`RequireRole`) send signed-out users to sign-in (with a safe return path), keep clients out
  of admin screens and admins out of the client portal, and block inactive accounts.

## Module 3 engineering choices

- **Role helper in `private` schema:** `private.is_admin()` (SECURITY DEFINER) is used by RLS policies and is
  not exposed through the REST API (Supabase advisor 0029).
- **Column-level grants:** API users may update only `profiles.full_name` and `profiles.phone` (own row; admins
  any row). Role/status/email changes require audited server functions (Modules 4–5).
- **Profiles are never deleted** (`ON DELETE RESTRICT` to `auth.users`); deactivate instead.
- **Password policy:** min 10 characters with a letter and a number (enforced in UI; set the same minimum in
  Supabase Auth settings).
- **PKCE auth flow** with session persisted by supabase-js; all cached data is cleared on sign-out.
- **RLS tests** run against the live project inside a rollback-only `DO` block (Docker not available for a
  local stack). See [SUPABASE.md](SUPABASE.md).
- **First admin** (`chaitanyanikam2004@gmail.com`) promoted on 12 Nov 2026 via CLI by the project owner's
  approval. Will be recorded in the audit log once it exists (Module 4).

## Module 1 engineering choices

- **ESLint 9** (not 10): `eslint-plugin-jsx-a11y` does not yet support ESLint 10. Upgrade once it does.
- **Inter self-hosted** via `@fontsource-variable/inter` — no third-party font requests.
- **Components** will be hand-written on Radix primitives (shadcn-style) rather than the shadcn CLI.
- **Dev-only audit findings:** `npm audit` reports moderate `minimatch` advisories inside the
  typescript-eslint toolchain only. Production dependencies report 0 vulnerabilities. Not force-fixed
  because `audit fix --force` would install breaking versions.
