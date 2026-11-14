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

- Fee method `fund_level_v2` (Module 15): the performance fee is taken from the **cycle's total profit**
  (net asset value − all money invested) and one NAV is published for every client. With money added
  mid-cycle there is **no equalisation**, so value can shift between clients who joined at different times
  (for example, a client who joins after a loss shares the fee on the recovery). Accepted by the owner; the
  client agreement should say so. No high-water mark: a fee accrues whenever the cycle is above the money
  invested, and falls back to zero on a loss.
- The **performance fee is not shown to clients** (they see the NAV after it). It must still be disclosed
  in the client agreement.
- The **admin fee** is a flat ₹ amount per client per cycle, deducted from the client's figures even with
  no profit. The current amount is used for live figures (editing it changes every client's figures at once);
  the amount at cycle close is frozen in the final-fees record.
- Units are issued at the latest NAV dated **before the day the money was received** (India time). If a
  day's NAV is published late, money verified in the meantime uses the last earlier NAV (the owner expects
  NAVs to arrive automatically each evening, so no block was added).
- NAVs published before Module 15 keep the earlier per-lot method (`per_lot_hwm_v1`) and are shown with it.
  Erase all data before a demo so every NAV uses the new method.
- NAV corrections never rewrite units already issued at the corrected NAV.
- For a **NAV correction**, outstanding units are counted by ledger time; money received before the
  valuation time but verified after it is not included in that past correction.
- Taxes, dividends, corporate actions, realised vs unrealised P&L and expense accruals are not modelled
  beyond manual "liabilities" and "other assets".

## Product / technical

- **Erase all data** (Settings → Danger zone) is enabled for the demo. It is irreversible (no backup or undo
  in the app) and must be switched off with `private.app_config.demo_reset_enabled = false` before real use.
- Proof-of-payment uploads are not implemented (database column reserved).
- New clients receive an admin-chosen temporary password (no invite email; default Supabase mailer only
  delivers to project team addresses). The forced password change is a UX guard, not server-enforced.
- Sign-in email cannot be changed from the app.
- Reports export at most 5,000 rows per CSV; PDF is via the browser's print dialog.
- Demo data timeline is compressed (three NAVs seconds apart) because NAVs can only be calculated from
  valuations dated after the units they cover, and the ledger records real time.
- Append-only records cannot be removed from the app. The one-off maintenance script
  `supabase/scripts/remove_demo_data.sql` (owner-run, audited) was used to remove the demo financial data.
- Single INR currency; India Standard Time display throughout.
- No MFA, rate-limit tuning, backups/PITR configuration or monitoring beyond Supabase defaults.
