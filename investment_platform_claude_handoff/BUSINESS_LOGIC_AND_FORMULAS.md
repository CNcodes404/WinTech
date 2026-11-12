# Business Logic and Financial Calculations

## 1. Investment window
An investment window (also called a cycle) has:
- Name
- Start date and end date
- Status: draft, open, active, closed, settled (settlement status is informational in V1)
- Base NAV at launch (illustrative default: ₹100)
- Configurable performance-fee percentage
- Fee calculation policy and high-water-mark policy
- Currency: INR

V1 should support one or more cycles in the data model, even if the first UI initially focuses on one active cycle.

## 2. Unit-based accounting
Use units to ensure that people joining at different times receive a fair proportional allocation based on the NAV applicable at their contribution acceptance time.

### Contribution units
`units_issued = accepted_contribution_amount / applicable_nav_per_unit`

Example:
- Initial NAV = ₹100
- Rahul contributes ₹100,000 at NAV ₹100 -> 1,000 units.
- NAV later becomes ₹105.
- Amit contributes ₹50,000 at NAV ₹105 -> 476.190476... units.
- NAV later becomes ₹110.
- Sagar contributes ₹150,000 at NAV ₹110 -> 1,363.636363... units.

Use sufficient precision for units (e.g. NUMERIC with at least 8 decimal places). Define a consistent rounding policy for displayed amounts and persisted unit quantities. Do not round units prematurely.

## 3. Gross NAV
At a valuation timestamp:

`gross_net_asset_value = total_asset_value - total_liabilities`

`gross_nav_per_unit = gross_net_asset_value / total_outstanding_units`

Assets may include:
- Market value of manually recorded holdings
- Cash balance
- Other explicitly modelled assets (only if required)

Liabilities may include:
- Brokerage and transaction costs
- Taxes/charges
- Accrued expenses
- Other payable amounts

For V1, the admin enters holdings, quantity, price, cash, and liabilities manually. The application calculates holding market value as `quantity * valuation_price`.

A portfolio valuation must have:
- Valuation timestamp
- Source = `manual_demo` in V1
- Status (draft / approved / superseded)
- Entered by
- Notes
- Immutable snapshot of holdings, cash and liabilities used for the calculation

Only an approved valuation should be used to publish a NAV snapshot.

## 4. Performance fee and client NAV
The admin can configure the performance-fee percentage per investment cycle. Do not hard-code 20%.

For a simple single-period illustration without prior loss carry-forward:
- `gross_profit_per_unit = max(0, gross_nav_per_unit - applicable_hurdle_or_hwm)`
- `performance_fee_per_unit = gross_profit_per_unit * fee_rate`
- `net_nav_per_unit = gross_nav_per_unit - performance_fee_per_unit`

Example:
- Reference NAV / HWM = ₹100
- Gross final NAV = ₹116
- Fee rate = 20%
- Gross profit per unit = ₹16
- Fee per unit = ₹3.20
- Net NAV = ₹112.80

This is an illustrative accounting approach, not a legal or tax conclusion. The actual fee model, timing, investor-specific high-water marks, equalisation and loss-recovery rules require explicit approval before production use.

## 5. High-water mark / loss recovery
Do not charge a performance fee merely because the portfolio has recovered from a loss if the agreed policy requires previous losses to be recovered first.

At minimum, model:
- Investor/capital-lot reference NAV or HWM
- Prior loss balance / loss carry-forward
- Fee rate applicable to that contribution lot
- Fee accrual / fee crystallisation event
- Fee calculation audit record

Different joining dates mean a single cycle-wide starting NAV may not be sufficient for every investor. The implementation should avoid charging a later entrant for gains made before they joined. Ask the product owner before choosing a detailed equalisation/HWM methodology. For V1, implement a transparent, testable simple per-contribution-lot model and label it demo-only.

## 6. Client value
`client_gross_value = client_units * gross_nav_per_unit`

`client_fee_allocation = client_units * performance_fee_per_unit` (only if the chosen policy supports this pro-rata method)

`client_net_value = client_units * net_nav_per_unit`

`client_net_profit_or_loss = client_net_value - client_contributed_capital` (adjust for additional contributions and any future withdrawals when those are designed)

## 7. Admin performance fee
The performance fee cannot be negative:
`admin_performance_fee = max(0, eligible_profit * fee_rate)`

If there is no eligible profit, fee is zero. The admin does not automatically bear market losses solely because the performance fee is zero. Liability for losses is a separate contractual/legal question and is not encoded as a negative fee.

## 8. Contributions
Contribution record should include:
- Client
- Investment cycle
- Amount
- Date/time received
- Method (UPI, cheque, bank transfer, other)
- Reference number / UTR / cheque number (optional)
- Proof attachment (optional)
- Status: pending, verified, rejected, reversed
- Verified by and verified timestamp
- Applicable NAV
- Units issued
- Ledger reference

For V1, admin records and verifies the contribution manually. A contribution must not issue units until verified and approved.

## 9. Portfolio entries
V1 admin manually records:
- Instrument / symbol
- Exchange (optional for demo)
- Quantity
- Average cost (optional)
- Valuation price
- Valuation date/time
- Holding market value
- Optional notes

Also record cash balance and liabilities. Do not treat the total contribution amount as the current portfolio value.

## 10. Important accounting invariants
- Total units = sum of all issued units minus any future redeemed units (withdrawals are out of scope).
- A contribution can issue units only once.
- Duplicate contribution verification must be prevented.
- A NAV snapshot references the exact valuation snapshot used.
- Published NAV snapshots are immutable; corrections create a new snapshot with a correction reason.
- Performance fee configuration changes are versioned and effective-dated; historical calculations retain the original rate.
- All financial values use PostgreSQL NUMERIC and a decimal library in TypeScript if calculations are needed in UI.
- Never calculate official NAV only in the browser.
- Every financial mutation creates an audit event.
