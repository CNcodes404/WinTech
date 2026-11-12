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

## Module 1 engineering choices

- **ESLint 9** (not 10): `eslint-plugin-jsx-a11y` does not yet support ESLint 10. Upgrade once it does.
- **Inter self-hosted** via `@fontsource-variable/inter` — no third-party font requests.
- **Components** will be hand-written on Radix primitives (shadcn-style) rather than the shadcn CLI.
- **Dev-only audit findings:** `npm audit` reports moderate `minimatch` advisories inside the
  typescript-eslint toolchain only. Production dependencies report 0 vulnerabilities. Not force-fixed
  because `audit fix --force` would install breaking versions.
