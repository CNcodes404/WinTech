# UI / UX Specification

## 1. Visual direction
Use a **Light Premium Fintech** visual system.

### Palette
- Primary navy: `#14243A`
- Emerald: `#0F9D83`
- Page background: `#F5F7FA` or `#F8FAFC`
- Card background: `#FFFFFF`
- Main text: `#172338`
- Secondary text: `#64748B`
- Border: `#E2E8F0`
- Warning / pending: `#D97706`
- Error / loss: `#DC2626`
- Positive / gain: `#0F9D83`

Use green only for positive performance or primary actions; use red for losses and destructive actions. Do not use color alone to convey status.

### Typography
- Inter.
- Clear hierarchy, medium/semibold headings.
- Tabular numerals for money, units, NAV and percentages.
- INR formatting (`₹1,25,000.00` where precision is needed).

### Components
- Subtle 1px borders, restrained shadows, rounded cards (8–12px).
- Avoid excessive gradients, glassmorphism and decorative charts.
- Use clear table filters, search, sorting, pagination and empty states.
- Desktop-first admin layout, fully responsive client portal.

## 2. Navigation
### Admin sidebar
1. Overview
2. Clients
3. Investment Cycles
4. Contributions
5. Portfolio
6. NAV & Performance
7. Profit Sharing
8. Settlements (disabled / coming later in V1)
9. Reports
10. Settings

Use a persistent sidebar on desktop and a compact drawer on mobile. Keep page titles and primary action visible.

### Client navigation
1. Overview
2. My Investment
3. Activity
4. Statements
5. Profile

Client portal must not expose admin-only pages or other clients' data.

## 3. Admin screens
### Overview
- Current cycle selector/status.
- Total verified contributions.
- Current manually entered portfolio value.
- Gross NAV and net NAV.
- Total outstanding units.
- Aggregate unrealized P/L.
- Configured performance-fee percentage.
- Recent activity.
- Quick actions: Add Client, Record Contribution, Add Valuation, Calculate NAV.
- Clearly label demo/manual values.

### Clients
- Search/filter client table.
- Name, email, phone, status, active cycle, contributed amount, units, current indicative value.
- Client detail page with profile, contributions, allocations, statements.
- Add/edit client flow.

### Investment cycles
- List and detail pages.
- Create cycle with name, date range, base NAV and configurable fee rate.
- Fee rate editable only with confirmation and version history; changes apply according to effective date and must not rewrite historical calculations.
- Cycle status transitions should be validated.

### Contributions
- Table with client, amount, date, method, reference, status.
- Add contribution form.
- Verify / reject actions with confirmation and audit reason.
- On verification, backend/database transaction calculates applicable NAV and issues units once.
- Show the NAV and units issued in the contribution detail.

### Portfolio
- Manual holdings editor.
- Fields: symbol, name, exchange, quantity, valuation price, average cost (optional), notes.
- Cash balance and liabilities.
- Preview total holdings market value and net asset value.
- Save valuation as draft, then approve.
- Show last valuation time and data source badge: `Manual demo entry`.
- No buy/sell order controls in V1.

### NAV & Performance
- Gross NAV, fee, net NAV, outstanding units.
- NAV history chart.
- Valuation history and detail.
- Calculate NAV / publish NAV with confirmation.
- Explain calculation inputs in a breakdown.
- Do not imply real-time stock pricing.

### Profit Sharing
- Admin-configurable percentage per cycle.
- Display the active fee rate and effective date.
- Show example calculation preview.
- Explain eligible profit and HWM/loss carry-forward.
- Keep a change history.
- Do not allow arbitrary client-specific fee editing without an explicit policy model.

### Reports
- Client-wise investment statement.
- Contribution register.
- Portfolio valuation report.
- NAV history.
- Performance-fee report.
- CSV export initially; PDF can be later.

## 4. Client screens
### Overview
- Current cycle status.
- Total contributed.
- Allocated units.
- Latest net NAV.
- Indicative net value.
- Net profit/loss.
- Start/end dates.
- Latest NAV chart and recent activity.
- Clear disclaimer that demo/manual figures are not live market data.

### My Investment
- Contribution lots with date, amount, entry NAV, units.
- Latest NAV and indicative value.
- Performance calculation breakdown.
- Fee deduction transparency.

### Activity
- Contributions, verification updates, unit allocation and published NAV events.

### Statements
- Downloadable statement (initially CSV or printable page).
- Only own records.

### Profile
- Personal information and login/security details.

## 5. Usability requirements
- Every page has a clear title, one primary action and concise supporting context.
- Forms have inline validation and useful error messages.
- Destructive/financial actions require confirmation.
- Provide loading, empty, success and error states.
- Use skeleton loading where appropriate.
- Avoid unexplained finance jargon; add tooltips for NAV, units, gross/net value and performance fee.
- Tables must work on smaller screens (responsive cards or horizontal scroll).
- Do not overload dashboards with every metric; prioritize the next action.
