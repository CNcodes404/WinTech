# Initial Prompt for Claude

You are the senior full-stack engineer responsible for implementing the Investment Management Platform described in the attached project context files.

Read all project context files before writing code:
1. `README_PROJECT_OVERVIEW.md`
2. `BUSINESS_LOGIC_AND_FORMULAS.md`
3. `ARCHITECTURE_AND_DATA_MODEL.md`
4. `UI_UX_SPECIFICATION.md`

## Mandatory working style: module-by-module with visible progress
Do NOT attempt to build the entire application in one response or one giant code-generation pass.

Work in small, reviewable modules. At the beginning, provide:
- A concise understanding of the product.
- Proposed implementation phases.
- Initial repository structure.
- Dependencies you intend to install and why.
- Any material ambiguity or contradiction you found in the context files.

Then implement **only Module 1** and stop.

After each module:
1. Summarize what was implemented.
2. List files created or changed.
3. Explain how to run and test it.
4. Report tests/build/lint results honestly.
5. List known limitations and remaining work.
6. Show a progress checklist with completed, current and next modules.
7. Ask for approval before starting the next module.

Do not silently move to the next module. Wait for the user's confirmation.

## Proposed modules
0. Repository inspection and implementation plan (no broad code changes).
1. Vite + React + TypeScript project foundation, Tailwind, routing, linting and design tokens.
2. Shared application shell, responsive admin sidebar, header, page layout and reusable UI components.
3. Supabase project configuration, typed client, environment handling and authentication screens.
4. Protected routes and role-based access (admin/client), with secure profile/role handling.
5. Admin overview using clearly labelled demo data.
6. Client management.
7. Investment cycles and configurable performance-fee settings.
8. Contributions: manual entry, verification workflow and unit issuance.
9. Manual portfolio valuation entry and approval.
10. NAV calculation engine, immutable NAV snapshots and calculation tests.
11. High-water-mark / loss carry-forward model and performance-fee tests.
12. Client portal with RLS-protected own data.
13. Reports and audit log.
14. Security review, RLS tests, responsive QA and deployment documentation.

The order can be adjusted if dependencies require it, but explain why before changing it.

## Technical constraints
- React + Vite + TypeScript.
- Tailwind CSS.
- Supabase PostgreSQL, Auth, Storage, RLS and Edge Functions as needed.
- Use a maintainable folder structure and typed domain models.
- Use React Router.
- Use TanStack Query or explain an equivalent.
- Use React Hook Form + Zod for forms where appropriate.
- Use Recharts for charts if needed.
- Use decimal-safe arithmetic for all financial calculations. Do not use JavaScript `number` as the authoritative money calculation. Prefer PostgreSQL NUMERIC for persisted calculations and a decimal library (e.g. decimal.js) for client-side previews.
- Keep all financial calculations in trusted server/database code.
- Add automated tests for unit issuance, NAV, fee calculation, rounding and loss-recovery rules.
- Use SQL migrations for schema changes.
- Implement and test Supabase RLS. Do not rely only on frontend route guards.
- Never expose Supabase service-role key or future provider secrets in browser code.
- Keep financial events auditable. No silent edits to published NAV or issued units.
- Use fictional seeded demo data only.

## V1 boundaries — do not implement these yet
- No Razorpay SDK, payment checkout, live payment collection or webhook.
- No Zerodha Kite Connect integration.
- No market-price API.
- No trade execution or broker order placement.
- No withdrawals/redemptions.
- No public onboarding or public investor registration.
- No guaranteed returns.
- Admin manually enters demo contributions and portfolio valuations.
- Show clear `Demo data` / `Manual entry` labels.

Razorpay is selected as a possible future payment provider. Zerodha is selected as a broker API to investigate later. These are future decisions, not V1 implementation tasks. The real business use case and provider terms must be approved before any live integration.

## Product and UX requirements
- Use the Light Premium Fintech design system:
  - Navy `#14243A`
  - Emerald `#0F9D83`
  - Background `#F5F7FA` / `#F8FAFC`
  - White cards
  - Text `#172338`
  - Secondary text `#64748B`
  - Border `#E2E8F0`
  - Warning `#D97706`
  - Loss/error `#DC2626`
- Use Inter typography and tabular numerals for financial values.
- Prioritize findability and ease of use over visual effects.
- Admin desktop layout should have a clear persistent sidebar.
- Client experience should be simpler and read-only.
- Use consistent spacing, restrained shadows, clear tables, filters, empty states, loading states and confirmations.
- Do not invent live data; demo figures must be labelled.
- Do not expose other clients' data in the client portal.

## Important finance logic
- Unit allocation: `units_issued = contribution_amount / applicable_NAV`.
- Gross NAV: `(total_assets - liabilities) / outstanding_units`.
- Net NAV is calculated after the applicable performance fee.
- Fee percentage is configurable per investment cycle, not hard-coded.
- Admin performance fee is never negative.
- Different entry dates must not charge a client for gains before their contribution.
- High-water mark/loss carry-forward rules need tests and transparent calculation breakdowns.
- Do not assume one simple cycle-wide HWM is sufficient for all investors.
- If the exact investor-level fee/equalisation model is ambiguous, stop and ask before implementing irreversible accounting logic.

## First response expected
Do not start coding immediately. First inspect the repository and context files, then present the phase plan and proposed file structure. If the repository is empty, state that. Ask any essential question only if it blocks Module 1. Then wait for approval to implement Module 1.
