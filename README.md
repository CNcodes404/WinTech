# WinTech — Investment Management Platform (V1 prototype)

Record-keeping prototype for a unit/NAV-based investment pool with **Admin** and **Client** roles.

> **Fictional demo data only.** This is not a live payment, brokerage or investment service. No
> Razorpay, Zerodha, market feeds, trading or withdrawals in V1. Do not use it for real client money
> until the structure has been reviewed by qualified professionals. See
> [`investment_platform_claude_handoff/`](investment_platform_claude_handoff/) and
> [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

## What it does

**Admin:** clients (logins with temporary passwords), investment cycles with versioned performance-fee
rates, manual contributions (verify → units issued once at the applicable NAV; reject; reverse), manual
portfolio valuations (draft → approve → correct), NAV calculation and publishing, per-lot performance-fee
accruals (high-water mark per contribution), dashboard, reports with CSV export, audit log, admin management.

**Client (read-only, own data only):** overview with indicative net value and P/L, contribution lots with a
step-by-step fee breakdown, activity, printable/CSV statements, profile and password.

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS v4 · React Router · TanStack Query · React Hook
Form + Zod · decimal.js · Recharts · Vitest + Testing Library + axe-core — Supabase (Postgres with RLS,
Auth, Edge Functions) — hosted on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL + publishable key
npm run dev                  # http://localhost:5173
```

| Script                            | Purpose                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                          |
| `npm run build`                   | Type-check + production build                                       |
| `npm test`                        | Unit, UI and accessibility tests (Vitest, mocked Supabase)          |
| `npm run test:db`                 | All 8 rollback-only database test suites against the linked project |
| `npm run check`                   | Lint + format check + tests + build                                 |
| `npm run lint` / `npm run format` | ESLint (a11y + float-money guards) / Prettier                       |

Supabase CLI setup and database workflow: [docs/SUPABASE.md](docs/SUPABASE.md).
Deployment (Vercel + Supabase settings): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project layout

```
src/
  app/            router, providers, navigation, route-level pages
  components/     ui/ (primitives) and layout/ (admin and client shells)
  features/       one folder per domain: auth, clients, cycles, contributions, portfolio,
                  nav, fees, overview, portal (client), reports, settings, audit
  lib/            finance (decimal previews), format (INR/IST), supabase client, csv, hooks
supabase/
  migrations/     schema, RLS, functions (source of truth)
  functions/      admin-create-client Edge Function
  tests/          rollback-only SQL test suites
  scripts/        security posture query, admin bootstrap
  seed/           fictional demo seed (permanent!)
docs/             decisions, rounding policy, security review, deployment, QA, limitations
```

## Financial correctness rules

- Official units, NAV and fees are computed in PostgreSQL `NUMERIC`; browser maths is preview-only.
- Never use JS `number` for money; ESLint blocks `parseFloat` and `Math.round`.
- Financial records are append-only; corrections are new records (reversals, corrections, new versions).
- Rounding policy: [docs/ROUNDING_POLICY.md](docs/ROUNDING_POLICY.md). Decisions: [docs/DECISIONS.md](docs/DECISIONS.md).
- Security: [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md). QA: [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md).
