# Rounding Policy (Decision F)

All persisted financial values use PostgreSQL `NUMERIC`. Browser code uses `decimal.js` (configured in
`src/lib/finance/decimal.ts`) for previews and display only — **never** JavaScript `number` arithmetic.

| Quantity     | DB type         | Scale | Mode     | Why                                               |
| ------------ | --------------- | ----- | -------- | ------------------------------------------------- |
| Money (INR)  | `NUMERIC(20,2)` | 2     | HALF_UP  | Standard paise rounding                           |
| NAV per unit | `NUMERIC(20,8)` | 8     | HALF_UP  | Precision for unit pricing                        |
| Units        | `NUMERIC(24,8)` | 8     | **DOWN** | Never over-issue units; residue stays in the pool |
| Fee rate     | `NUMERIC(8,6)`  | 6     | HALF_UP  | `0.200000` = 20%                                  |

## Rules

1. Round **once**, at the final step of each formula. Intermediate values keep full precision.
2. Units issued = `round_down_8(amount / nav)`. Therefore `units × entry_nav ≤ amount` always holds.
3. Values sent from the database should arrive as **strings** (NUMERIC cast to text) to avoid JSON
   float conversion. This will be enforced in the data layer from Module 3.
4. Display formatting (`src/lib/format`) rounds HALF_UP for presentation and never changes stored values.
5. The PostgreSQL functions added in Modules 7–10 must implement exactly this table; tests on both
   sides use the same worked examples.

## Reference examples (tested)

| Input                                                           | Result                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| ₹1,00,000 ÷ ₹100                                                | 1,000.00000000 units                                   |
| ₹50,000 ÷ ₹105                                                  | 476.19047619 units                                     |
| ₹1,50,000 ÷ ₹110                                                | 1,363.63636363 units (not …64)                         |
| Gross ₹116, HWM ₹100, 20%                                       | Fee ₹3.20 / unit, net ₹112.80 (earlier per-lot method) |
| Assets ₹1,30,000, invested ₹1,00,000, 1,000 units, 50%          | Fee ₹15,000.00 → NAV ₹115.00000000                     |
| …then admin fee ₹1,000                                          | Profit ₹15,000.00 → final profit ₹14,000.00            |
| Assets ₹2,80,000, invested ₹2,30,000, 2,130.43478260 units, 50% | Fee ₹25,000.00 → NAV ₹119.69387755                     |

Fund-level fee (Module 15): `fee = round_half_up_2(max(0, assets − invested) × rate)`, then
`NAV = round_half_up_8((assets − fee) / units)`. Client value = `round_half_up_2(units × NAV)`.
