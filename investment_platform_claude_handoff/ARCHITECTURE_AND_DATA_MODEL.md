# Architecture and Initial Data Model

## 1. Architecture

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- React Router
- TanStack Query (or an equivalent server-state library)
- React Hook Form + Zod for form validation
- Recharts for dashboard charts
- A consistent component system (shadcn/ui is acceptable)

### Supabase
- PostgreSQL as source of truth
- Supabase Auth
- Row Level Security on every user-data table
- Storage for receipts/statements
- Realtime only for useful dashboard refreshes
- Edge Functions for privileged server-side operations when needed

Do not put Supabase service-role keys, Razorpay secrets, or future Zerodha API secrets in browser code or Vite environment variables exposed to the client.

## 2. Roles and access
- `admin`: full access to operational records.
- `client`: read-only access to their own profile, contributions, allocations, NAV/performance and statements.
- Do not trust a role supplied by the browser. Store role in a protected profile/role table and enforce it with RLS.
- Admin creation should be controlled; public sign-up must not allow a user to self-assign admin.
- Client profile should be linked to the authenticated Supabase user ID.

## 3. Suggested tables
Use UUID primary keys, `created_at`, and appropriate foreign keys. Use `NUMERIC`, not floating-point, for monetary amounts and NAV.

### `profiles`
- `id` UUID PK, references `auth.users.id`
- `full_name`
- `email`
- `phone` nullable
- `role` enum: admin/client (protected from client self-edit)
- `status`: active/inactive
- timestamps

### `investment_cycles`
- `id`
- `name`
- `description`
- `start_date`, `end_date`
- `status`: draft/open/active/closed/settled
- `base_nav NUMERIC(20,8)` default 100
- `performance_fee_rate NUMERIC(8,6)` (e.g. 0.20 = 20%)
- `fee_policy_version`
- `created_by`
- timestamps

### `contributions`
- `id`
- `cycle_id`
- `client_id` (profile ID)
- `amount NUMERIC(20,2)`
- `received_at`
- `method`
- `reference_number`
- `proof_storage_path`
- `status`: pending/verified/rejected/reversed
- `verified_by`, `verified_at`
- `applicable_nav NUMERIC(20,8)`
- `units_issued NUMERIC(24,8)`
- unique idempotency / business key to prevent duplicate unit issuance
- timestamps

### `portfolio_valuations`
- `id`
- `cycle_id`
- `valuation_at`
- `source` = manual_demo for V1
- `status`: draft/approved/superseded
- `cash_balance NUMERIC(20,2)`
- `other_assets NUMERIC(20,2)`
- `liabilities NUMERIC(20,2)`
- `gross_asset_value NUMERIC(20,2)`
- `gross_net_asset_value NUMERIC(20,2)`
- `entered_by`, `approved_by`, `approved_at`
- `notes`
- timestamps

### `portfolio_valuation_items`
- `id`
- `valuation_id`
- `symbol`
- `instrument_name`
- `exchange`
- `quantity NUMERIC(24,8)`
- `valuation_price NUMERIC(20,8)`
- `market_value NUMERIC(20,2)`
- `average_cost NUMERIC(20,8)` nullable
- `notes`

### `nav_snapshots`
- `id`
- `cycle_id`
- `valuation_id`
- `calculated_at`
- `total_outstanding_units NUMERIC(24,8)`
- `gross_net_asset_value NUMERIC(20,2)`
- `gross_nav_per_unit NUMERIC(20,8)`
- `performance_fee_rate NUMERIC(8,6)`
- `performance_fee_amount NUMERIC(20,2)`
- `net_nav_per_unit NUMERIC(20,8)`
- `status`: draft/published/corrected
- `calculation_version`
- `created_by`
- timestamps

### `client_unit_allocations`
- `id`
- `cycle_id`
- `client_id`
- `contribution_id`
- `units_issued NUMERIC(24,8)`
- `entry_nav NUMERIC(20,8)`
- `reference_hwm NUMERIC(20,8)` nullable
- `loss_carry_forward NUMERIC(20,2)` default 0
- `fee_rate NUMERIC(8,6)`
- `created_at`

### `settlements`
- Schema placeholder only; no withdrawal/settlement processing in V1.
- `id`, `cycle_id`, `client_id`, amount, status, paid_at, reference_number, notes.

### `audit_logs`
- `id`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `before_data JSONB`
- `after_data JSONB`
- `reason`
- `created_at`

### `app_settings`
- Protected admin-configurable display and demo settings.
- Do not use this table as a substitute for versioned fee terms attached to a cycle.

## 4. Database functions / transactions
Implement sensitive operations as Postgres functions or trusted Edge Functions backed by database transactions:
- Verify contribution and issue units exactly once.
- Approve portfolio valuation.
- Calculate NAV snapshot.
- Publish NAV snapshot.
- Calculate client valuations and performance fee.
- Write audit log atomically with the business operation.

Never let the client browser directly insert an issued unit allocation or publish NAV.

## 5. RLS policy intent
- Client can select own profile only.
- Client can select own contributions, unit allocations, and client-facing NAV/valuation summaries.
- Client cannot select other clients' personal records or private admin notes.
- Client cannot insert/update financial ledger rows.
- Admin can manage records according to admin role.
- Storage receipts must be private; authorize access through policies or short-lived signed URLs.
- Test RLS with at least two clients and one admin.

## 6. Future integrations (not V1)
### Razorpay
- Selected for possible future payment integration.
- Not to be installed or integrated in V1.
- Future design: server creates order, client completes checkout, backend verifies signature, webhook signature verified, idempotent webhook processing, contribution remains pending until confirmed and reviewed.
- Razorpay must approve the actual business use case. A gateway is not authorization to collect investment capital.
- Keep payment provider references nullable in the V1 schema if useful, but do not build live payment flows.

### Zerodha Kite Connect
- Preferred broker to investigate later, not part of V1.
- Future integration must run server-side; never expose API secret or access token in browser.
- Do not assume a personal API key/account can be used to manage pooled third-party assets or redistribute broker data. Confirm broker terms, account structure, applicable rules and data licensing first.
- V1 manual valuations should be clearly marked as manually entered demo data.

## 7. Environment variables
Frontend-safe:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-side only (when required):
- `SUPABASE_SERVICE_ROLE_KEY`

Do not create Razorpay or Zerodha secrets in V1 because those integrations are out of scope.
