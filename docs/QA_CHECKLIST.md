# QA checklist

## Automated

| Area                                         | How                                                                              | Status (13 Nov 2026) |
| -------------------------------------------- | -------------------------------------------------------------------------------- | -------------------- |
| Finance helpers, formatting, rounding        | Vitest unit tests                                                                | Pass                 |
| Screens, forms, flows (mocked Supabase)      | Vitest + Testing Library                                                         | Pass                 |
| Accessibility (11 key screens)               | `tests/a11y.test.tsx` with axe-core (contrast excluded: not computable in jsdom) | No violations        |
| Database rules, RLS, isolation, immutability | `npm run test:db` (9 suites, 175 checks)                                         | Pass                 |
| Live end-to-end (real login + portal RPC)    | Manual script run during Module 14                                               | Pass                 |
| Type safety / lint / format                  | `npm run check`                                                                  | Pass                 |

Axe found and we fixed one issue during Module 14: duplicate "Client" navigation landmark labels.

## Manual responsive & accessibility pass (to repeat before demos)

Viewports: 375 px (phone), 768 px (tablet), 1280 px (laptop), 1920 px (desktop).

- [ ] Admin sidebar visible ≥ 1024 px; drawer menu below, closes after navigation
- [ ] Client top tabs ≥ 768 px; bottom tab bar on phones, not covering content
- [ ] Wide tables scroll horizontally inside their card; no page-level horizontal scroll
- [ ] Mobile card lists for clients, contributions and cycles
- [ ] Dialogs fit the viewport and scroll internally; Esc closes (except while saving)
- [ ] Keyboard only: skip link, visible focus ring, all actions reachable, tooltips on focus
- [ ] Screen reader: page titles, headings, form errors announced, status badges have text
- [ ] Colour is never the only signal (badges have icons/text; P/L has sign and arrow)
- [ ] Contrast: body text on white ≥ 4.5:1 (ink `#172338`, muted `#64748B` on `#FFFFFF`)
- [ ] Print: client statement and admin client statement print without navigation
- [ ] Numbers: Indian grouping (₹1,25,000.00), tabular figures aligned in tables
- [ ] Every figure screen shows the demo / manual-entry label or disclaimer
