# WinTech — Investment Management Platform (V1 prototype)

Record-keeping prototype for a unit/NAV-based investment pool with **Admin** and **Client** roles.

> **Fictional demo data only.** This is not a live payment, brokerage or investment service. No
> Razorpay, Zerodha, market feeds, trading or withdrawals in V1. See
> [`investment_platform_claude_handoff/`](investment_platform_claude_handoff/) for the full brief.

## Stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS v4 · React Router · TanStack Query ·
decimal.js · Vitest — Supabase (Postgres, Auth, RLS, Storage, Edge Functions) from Module 3.

## Getting started

```bash
npm install
cp .env.example .env.local   # values needed from Module 3 onward
npm run dev                  # http://localhost:5173
```

| Script           | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `npm run dev`    | Dev server                                                |
| `npm run build`  | Type-check + production build                             |
| `npm test`       | Unit/component tests (Vitest)                             |
| `npm run lint`   | ESLint (incl. accessibility rules and float-money guards) |
| `npm run format` | Prettier                                                  |

## Project layout

```
src/
  app/            router, providers, route-level pages
  components/     ui/ (primitives) and layout/ (shells) — Module 2
  features/       one folder per domain (clients, cycles, contributions, …)
  lib/finance/    decimal-safe preview calculations + rounding policy
  lib/format/     INR (₹1,25,000.00), units, NAV, %, IST dates
  styles/         Tailwind entry + design tokens
supabase/         migrations, RLS, functions, seed — Module 3+
docs/             decisions log, rounding policy
```

## Financial correctness rules

- Official NAV, units and fees are computed in PostgreSQL. Browser math is preview-only.
- Never use JS `number` for money; ESLint blocks `parseFloat` and `Math.round`.
- Rounding policy: [docs/ROUNDING_POLICY.md](docs/ROUNDING_POLICY.md). Decisions: [docs/DECISIONS.md](docs/DECISIONS.md).
