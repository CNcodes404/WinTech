# Decisions Log

Approved by the product owner on 12 Nov 2026 (Module 0 plan review). All accounting rules below are a
**demo-only model** and require professional review before any production use.

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Applies in   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| A   | **Per-lot fee model.** Gross NAV is computed for the whole cycle. Performance fee is accrued per contribution lot in `lot_fee_accruals` (lot HWM, loss carry-forward, eligible profit, fee, net value). Snapshot fee total = sum of lot accruals. Any "net NAV per unit" shown is a labelled weighted average.                                                                                                                                                                                                                                                                                                                                 | Modules 9–10 |
| B   | **Unit issuance NAV.** Units are issued at the latest _published gross NAV_ as of the contribution's `received_at`; if none exists, the cycle's `base_nav`. That NAV becomes the lot's starting HWM, so later entrants are not charged for earlier gains.                                                                                                                                                                                                                                                                                                                                                                                      | Module 7     |
| C   | **Fee-rate versioning.** Rates live in a versioned, effective-dated `cycle_fee_terms` table. Each lot locks the rate in force when it is issued; later changes apply only to lots issued after the effective date.                                                                                                                                                                                                                                                                                                                                                                                                                             | Modules 6–7  |
| D   | **Crystallisation.** V1 accrues fees only (indicative). Crystallisation is an informational event at cycle close; no money moves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Module 10    |
| E   | **Stale valuation guard.** NAV calculation warns/blocks when units were verified after the valuation timestamp; a fresh valuation must be recorded first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Module 9     |
| F   | **Rounding policy.** See [ROUNDING_POLICY.md](ROUNDING_POLICY.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | All          |
| G   | **Account provisioning.** Public sign-up is disabled. First admin is bootstrapped via SQL; clients are created by an admin through an Edge Function that holds the service-role key server-side.                                                                                                                                                                                                                                                                                                                                                                                                                                               | Modules 3–4  |
| H   | **Module order.** Schema is introduced per feature module; Admin Overview moved after the NAV/fee modules so it uses real seeded data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Plan         |
| I   | **Supabase environment.** Use the product owner's hosted Supabase project.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Module 3     |
| K   | **Fund-level fee, admin fee, previous-day NAV (Module 15, 14 Nov 2026).** Supersedes A and the per-lot parts of B/C for new NAVs. Performance fee = rate × max(0, cycle assets − money invested); one NAV = (assets − fee) / units for every client, which clients see; the fee itself is never shown to clients. Flat ₹ admin fee per client per cycle (default ₹1,000, editable until settled), always deducted. Money received on a day gets the latest NAV dated before that day (India time). Performance-fee rate editable only while draft/open; a cycle cannot start trading with a change pending. Default performance fee stays 20%. | Module 15    |
| J   | **Admin data reset (14 Nov 2026, owner request).** Admins may erase all business data and non-account audit history from Settings → Danger zone; users are never deleted. The only exception to append-only records, guarded by a typed phrase, a reason, an audit entry and a server-side kill switch.                                                                                                                                                                                                                                                                                                                                        | Post-V1      |

## Module 13 engineering choices

- **Reports** (admin only, read-only, CSV export): contribution register (status, cycle, IST date range;
  includes admin notes), client statement (any client/cycle, printable), valuation report (holdings + totals),
  NAV history (published and corrected), performance-fee report (per lot at a chosen published NAV).
- **Exports are capped at 5,000 rows** with a visible warning; preview shows 50 rows.
- **CSV safety:** shared `src/lib/csv.ts` with RFC 4180 quoting and spreadsheet-formula neutralisation; UTF-8 BOM.
- **Audit log viewer:** filters by type, exact action, actor (including system/project owner) and IST date
  range; 50 per page; expandable before/after JSON; CSV export. Read-only (the table is append-only).
- **Settings = administrator management** via the audited `admin_set_user_role` (grant to active clients,
  remove from others; not self; last-admin protection in the DB) plus own password change. No generic
  `app_settings` table (not needed in V1).
- **Printing:** admin and client shells hide navigation and filters in print, so statements print cleanly.
- No schema changes.

## Module 12 engineering choices (approved: "go with your recommendations")

- **Client reads go only through `client_*` SECURITY DEFINER functions** that require an active client and
  return only the caller's own rows and client-safe columns. Clients have no direct access to contributions,
  ledger, valuations, holdings, NAV or fee tables (RLS stays admin-only). Postgres column privileges cannot
  differ per user, so this is safer than client views.
- **Never shown to clients:** admin notes, admin-written reasons (verify/reject/reverse), who verified, other
  clients, portfolio holdings, the audit log.
- **Client activity** is built from facts (contributions, unit issues, published NAVs), not the admin audit log.
- **Clients may edit their own name and phone** (column grants + RLS; audited). Email is not editable.
- **Forced password change:** accounts created by an admin get `must_change_password = true`; the app routes them
  to "Set your own password" until done; `complete_password_change()` clears the flag for the caller only and
  is audited. Usability guard (the server cannot verify the password actually changed).
- **Statements:** printable page (Print → Save as PDF; app chrome hidden in print) and a CSV download of the
  client's own records. CSV cells are protected against spreadsheet-formula injection.
- **Client P/L** compares the lots valued at the latest NAV with their own contributed capital; money verified
  after the latest NAV is flagged as "valued at the next NAV".

## Module 11 engineering choices

- **Admin overview is per cycle** (defaults to the active/open cycle; selector in the URL).
- **Unrealised P/L** = Σ lot gross value − Σ lot contributed capital at the **latest published NAV**, using the
  server's per-lot figures so capital and value refer to the same lots and as-of time; "after fee" uses lot net
  values. Shown only once a NAV is published.
- **"Needs your attention"** lists pending contributions, valuation drafts and the NAV draft for the cycle.
- **Recent activity** is the latest audit-log entries across all entity types, described with each feature's
  own wording and linked to the entity.
- **First-run checklist** (client → cycle → open → contribution → valuation → NAV) shows until a NAV is published.
- No schema changes.

## Module 10 — performance-fee model `per_lot_hwm_v1` (approved 12 Nov 2026, demo only)

- **Per contribution lot, at each NAV snapshot:** eligible profit per unit = max(0, gross NAV − lot HWM);
  fee = ROUND(units × eligible profit × lot fee rate, 2); gross value = ROUND(units × gross NAV, 2);
  net value = gross value − fee; loss to recover = ROUND(units × max(0, HWM − gross NAV), 2).
- **HWM = the lot's entry NAV for the whole cycle.** Fees are accrued (indicative), not charged, during a cycle,
  so losses are always recovered before any fee and later entrants are never charged for earlier gains. Each
  cycle starts fresh (no cross-cycle loss carry-forward, no annual reset).
- **Lots included** = issued at or before the NAV's as-of time and not reversed by then; Σ lot units must equal
  the snapshot's units (enforced).
- **Snapshot totals:** fee = Σ lot fees; net NAV per unit = ROUND((net asset value − fee) ÷ units, 8), a
  weighted average labelled as such. Computed automatically by trigger when a snapshot is created, frozen on
  publish. Accruals are append-only for every role.
- **Crystallisation (Decision D):** after a cycle is closed, the admin can record the final indicative fee once
  (latest published NAV). Informational only — no money moves, nothing is deducted.
- **No client-specific fee editing.** Fee rates come only from versioned cycle terms locked per lot.
- Spec example verified in the DB: HWM ₹100 → gross ₹116 at 20% → fee ₹3,200 on 1,000 units, net ₹1,12,800,
  net NAV ₹112.80.

## Module 9 engineering choices

- **Gross NAV per unit = ROUND(net asset value ÷ outstanding units, 8)** (HALF_UP, dividend widened first).
  Outstanding units = unit-ledger total with `created_at ≤ valuation_at`.
- **NAV only from an approved valuation**; the snapshot stores the valuation id, units and net asset value used.
- **Lifecycle:** draft → published (immutable) → corrected (only by a published correction for the same as-of
  time); draft → discarded. One draft per cycle (recalculating replaces it). Never deleted.
- **Decision E implemented:** a new NAV is refused if the unit ledger changed after the valuation time; the
  admin records a newer valuation. Corrections re-value the same past time with the units as of then.
- **Published NAVs move forward in time** per cycle (no back-dated publishing except corrections). NAV ≤ 0 and
  zero outstanding units are refused.
- **Decision B implemented:** `private.applicable_nav` = latest _published_ gross NAV with
  `nav_date ≤ received_at`, else base NAV. Corrected snapshots are excluded for future issuance;
  **units already issued are never rewritten.** Spec example verified in the DB: Amit ₹50,000 at published
  ₹105 → 476.19047619 units.
- **Known V1 limitation:** for a _correction_, units are counted by ledger time; a contribution received
  before the valuation time but verified after it is not included in that past correction's units.
- **Fee columns** (`performance_fee_amount`, `net_nav_per_unit`) exist but stay empty until Module 10.
- **Charts:** Recharts, lazy-loaded with the NAV page (main bundle stays ~51 kB gzipped). Single series, no
  legend, dashed base-NAV reference, hover tooltip with the exact decimal; the snapshot table is the
  accessible alternative.

## Module 8 engineering choices

- **Valuation lifecycle:** draft (editable) → approved (immutable snapshot) → superseded (only by an approved
  correction of the same cycle); or draft → discarded. Nothing is deleted; at most one open correction per
  valuation.
- **Server computes all derived amounts** (`market_value = ROUND(qty × price, 2)` per line, then holdings, gross
  assets, net asset value). A table constraint enforces the totals identity on every write. The editor shows a
  decimal-safe preview only.
- **Inputs:** cash/other assets/liabilities ≥ 0 with 2 decimals; quantity > 0 and price ≥ 0 with 8 decimals;
  symbols normalised to upper case; exchange NSE/BSE/Other/blank; one line per symbol + exchange; ≤ 200 lines.
  Net asset value may be negative (shown in red), never hidden.
- **Valuations allowed for open, active and closed cycles** (closing valuation); not for draft or settled.
  Valuation time cannot be in the future.
- **New valuations are pre-filled from the latest approved one** (copy-forward), with the time reset to now.
- **No buy/sell controls** and source is always `manual_demo`, labelled "Manual demo entry".

## Module 7 engineering choices (approved: "go with your proposals")

- **Contributions are accepted only while a cycle is open or active**; verification and reversal likewise.
- **Applicable NAV = cycle base NAV until NAV publishing exists (Module 9).** Isolated in
  `private.applicable_nav(cycle, received_at)`; Module 9 changes only that function to "latest published gross
  NAV as of received_at, else base NAV" (Decision B).
- **Units = TRUNC(amount ÷ NAV, 8)**, computed in Postgres after widening the dividend to scale 20.
  Invariant tested: units × entry NAV ≤ amount.
- **Unit ledger is append-only** (`client_unit_allocations`): one `issue` row per verified contribution (unique),
  at most one `reversal` row with exactly the negated units. Outstanding units = SUM(units). No updates/deletes
  for any role.
- **Each lot locks** entry NAV, reference HWM (= entry NAV), loss carry-forward (0) and the fee rate/version in
  force at the verification instant (`clock_timestamp()`).
- **Verify, reject and reverse all need a written reason** (audit). Verification shows the server's own preview
  (`admin_preview_verification`) so the admin confirms authoritative numbers.
- **Duplicate guard:** the same method + payment reference cannot be live (pending/verified) twice.
- **Recorded facts are immutable** (amount, date, method, reference, client, cycle); mistakes are fixed by
  rejecting (pending) or reversing (verified) and recording again.
- **Inactive clients:** new contributions and verification are blocked until reactivated.
- **Proof attachments deferred**; `proof_storage_path` column reserved. Admin notes are never exposed to clients
  (client views in Module 12 will exclude them).

## Module 6 engineering choices

- **Fee terms are versioned and append-only** (`cycle_fee_terms`). Version 1 is created with the cycle and is
  effective immediately. New versions take effect immediately or from 00:00 IST on a future date; **backdating
  is rejected**. A version that has not taken effect yet can be **cancelled** (kept, with reason); effective
  versions can never be edited or deleted — not even by the database owner.
- `private.fee_terms_at(cycle, time)` returns the rate in force at any instant; Module 7 uses it so each
  contribution lot locks the rate in force when it is issued (Decision C).
- **Fee rate range:** 0% ≤ rate < 100%, at most 4 decimals as a percentage (6 as a fraction). No default rate is
  hard-coded; the admin must enter one.
- **Lifecycle:** draft → open → active → closed → settled, one step at a time, with a mandatory reason. Base NAV
  is editable only in draft; dates only in draft/open; closed/settled cycles are read-only. Enforced by a
  trigger for every role, and mirrored in the UI.
- **Cycles are never deleted.** Clients cannot see cycles yet; visibility of their own cycles comes with the
  client portal (Module 12).
- **NUMERIC values travel as strings** in both directions (`col::text` in selects, string parameters to RPCs).

## Module 5 engineering choices

- **Client list** is server-side filtered, sorted and paginated (20 per page); state lives in the URL so views
  are shareable and survive refresh. Search text is sanitised before it is embedded in the PostgREST filter.
- **Contributed amount / units / indicative value** columns are deferred until contributions and NAV exist
  (Modules 7–9) rather than shown as placeholders.
- **Email (sign-in identity) is not editable** in V1. Name and phone are editable by admins (audited by trigger).
- **Activate / deactivate** requires a written reason and goes through `admin_set_user_status` (audited).
- **Temporary passwords** are generated in the browser with `crypto.getRandomValues` (14 chars, unambiguous
  alphabet), shown once after creation, and never stored by the app.

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
