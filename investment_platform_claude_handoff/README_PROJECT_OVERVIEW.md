# Investment Management Platform — Project Handoff

## Purpose
Build a responsive web application prototype for an investment-management workflow with two roles:
- **Admin:** manages clients, investment windows, contributions, portfolio records, NAV, performance-fee configuration, and settlement records.
- **Client:** views only their own investment summary, contribution history, allocated units, NAV/performance history, statements, and settlement status.

This handoff describes a **software prototype and recordkeeping system**. It does not authorize accepting, pooling, managing, or trading real client funds. A friends-only arrangement is not automatically exempt from applicable Indian securities, deposit, payment-provider, or other laws. Do not enable live money collection, trading, or investment solicitation until the exact structure and provider use case have been reviewed and approved by qualified professionals and the relevant providers.

## Confirmed decisions
| Area | Decision |
|---|---|
| Frontend | React + Vite + TypeScript |
| UI styling | Tailwind CSS |
| Backend platform | Supabase |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Role-based access + PostgreSQL Row Level Security |
| File storage | Supabase Storage |
| Realtime | Supabase Realtime where useful |
| Server-side functions | Supabase Edge Functions initially |
| Portfolio data | Admin enters demo/manual portfolio data in V1 |
| Future broker | Zerodha Kite Connect is the preferred option to investigate later; not part of V1 |
| Payments | Razorpay selected for possible future integration; not part of V1 |
| V1 payments | Manual recording only, clearly marked as demo/manual and not a live payment flow |
| Profit sharing | Configurable by admin for the demo; example default may be 20%, but it must not be hard-coded |
| NAV | Unit-based NAV calculation |
| Withdrawals | Deferred; do not implement withdrawal processing in V1 |
| Delivery approach | Claude must implement module-by-module, pause after each module, show progress and wait for approval |

## Product principles
1. **Usability first:** clear labels, predictable navigation, low click count, accessible forms, helpful empty states.
2. **Financial correctness:** use decimal-safe arithmetic; never use JavaScript floating-point values as the authoritative money calculation.
3. **Auditability:** financial events are append-only or corrected through reversing/adjustment entries. Do not silently overwrite financial history.
4. **Privacy:** clients can only access their own records. Admin-only information must never leak to clients.
5. **Server authority:** NAV, units, fees, payment status and permissions must be validated server-side/database-side, not trusted from browser input.
6. **Demo clarity:** use seeded fictional data and persistent DEMO labels where relevant. Never imply demo figures are live brokerage data.
7. **No premature integrations:** no Razorpay SDK, live payment collection, Zerodha API, trading, or automated withdrawals in V1.

## V1 scope
- Authentication and role routing.
- Admin overview dashboard.
- Client management.
- Investment windows / cycles.
- Manual contribution recording and verification status.
- Manual portfolio holdings and cash entry.
- NAV snapshots and historical NAV.
- Unit allocation for contributions.
- Configurable performance-fee percentage.
- High-water-mark / loss-recovery accounting model documented and test-covered.
- Client read-only dashboard.
- Basic statements/reports.
- Audit log.
- Demo seed data.

## Explicitly out of scope for V1
- Razorpay integration or live payment processing.
- Zerodha Kite Connect integration.
- Automatic market-price feeds.
- Order placement or trade execution.
- Withdrawals and redemption workflows.
- Guaranteed returns or fixed-return promises.
- Public investor registration or marketing.
- Legal/compliance onboarding automation.
