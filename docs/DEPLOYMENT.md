# Deployment

The frontend is a static Vite build hosted on **Vercel**; the backend is the Supabase project **Wintech**.

## Current production setup (13 Nov 2026)

| Item                     | Value                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Production URL           | **https://wintechapp.vercel.app** (project domain; every `--prod` deploy aliases here) |
| Vercel project           | `wintech` (linked locally via `.vercel/`, git-ignored)                                 |
| Vercel env vars          | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable) — Production + Preview     |
| Edge Function CORS       | `ALLOWED_ORIGINS=https://wintechapp.vercel.app` (+ localhost:5173 built in)            |
| Per-deployment URLs      | Protected by Vercel Authentication (302 to sign-in)                                    |
| Deploy from this machine | `npx vercel deploy --prod --yes`                                                       |

`wintechapp.vercel.app` was chosen because `wintech.vercel.app` belongs to another Vercel user.

## 1. Frontend on Vercel (one-time)

1. Sign in at <https://vercel.com> with GitHub.
2. **Add New → Project → Import** the `WinTech` repository.
3. Framework preset: **Vite** (settings come from `vercel.json`: build `npm run build`, output `dist`).
4. **Environment Variables** (Production and Preview):

   | Name                     | Value                                        |
   | ------------------------ | -------------------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://<project-ref>.supabase.co`          |
   | `VITE_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`) |

   Never add a secret or service-role key — the app refuses to start with one.

5. **Deploy.** Every push to `main` redeploys automatically; pull requests get preview URLs.

`vercel.json` provides SPA rewrites (deep links work on refresh), immutable caching for hashed assets and
security headers (CSP, frame denial, nosniff, referrer and permissions policies, `noindex`).

## 2. Supabase settings for the production URL

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** add `https://<your-app>.vercel.app/reset-password` (keep the localhost entry for development).

Allow the production origin to call the Edge Function (CORS):

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://<your-app>.vercel.app
```

(`http://localhost:5173` is always allowed for development.)

## 3. Database changes

All schema changes are migrations in `supabase/migrations/`:

```bash
npx supabase db push --remote          # apply
npm run test:db                        # 8 rollback-only suites against the live DB
npx supabase db query --remote --read-only -f supabase/scripts/security_posture.sql
npx supabase gen types typescript --remote --schema public > src/lib/supabase/database.types.ts
```

## 4. Release checklist

- [ ] `npm run check` (lint, format, unit/UI tests, build) passes
- [ ] `npm run test:db` passes
- [ ] Security posture query clean (only documented exceptions)
- [ ] Vercel deployment green; production URL loads, deep link (e.g. `/login`) works on refresh
- [ ] Sign-in, password reset email link, and an admin-created client's first sign-in work on the production URL

## 5. Demo data

`supabase/seed/demo_seed.sql` creates fictional demo data **permanently** (append-only records cannot be
deleted). It is idempotent and has already been run on Wintech (13 Nov 2026). Use a separate Supabase
project if you need a resettable demo.
