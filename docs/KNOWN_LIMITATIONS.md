# Known limitations (V1 prototype)

This is a **demonstration and record-keeping prototype with fictional data**. It must not be used to
accept, pool, manage or report real client money until the legal structure, fee model and providers have
been approved by qualified professionals (see README).

## Out of scope by design (V1)

- No payment gateway (Razorpay), broker integration (Zerodha), market-price feeds or order placement.
- No withdrawals, redemptions or settlement processing (Settlements is disabled).
- Fees are **accrued for information only**; nothing is deducted or paid. Crystallisation at cycle close is
  an informational record.
- No public sign-up or investor onboarding.

## Accounting model simplifications (approved demo model)

- Fee method `per_lot_hwm_v1`: each lot's high-water mark is its entry NAV for the whole cycle; no
  equalisation, no cross-cycle loss carry-forward, no annual HWM reset.
- Net NAV per unit at cycle level is a weighted average across lots.
- NAV corrections never rewrite units already issued at the corrected NAV.
- For a **NAV correction**, outstanding units are counted by ledger time; money received before the
  valuation time but verified after it is not included in that past correction.
- Taxes, dividends, corporate actions, realised vs unrealised P&L and expense accruals are not modelled
  beyond manual "liabilities" and "other assets".

## Product / technical

- Proof-of-payment uploads are not implemented (database column reserved).
- New clients receive an admin-chosen temporary password (no invite email; default Supabase mailer only
  delivers to project team addresses). The forced password change is a UX guard, not server-enforced.
- Sign-in email cannot be changed from the app.
- Reports export at most 5,000 rows per CSV; PDF is via the browser's print dialog.
- Demo data timeline is compressed (three NAVs seconds apart) because NAVs can only be calculated from
  valuations dated after the units they cover, and the ledger records real time.
- Demo seed data in Wintech is permanent (append-only records).
- Single INR currency; India Standard Time display throughout.
- No MFA, rate-limit tuning, backups/PITR configuration or monitoring beyond Supabase defaults.
