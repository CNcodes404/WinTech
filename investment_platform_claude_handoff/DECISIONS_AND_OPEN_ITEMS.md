# Decisions and Open Items

## Confirmed for V1
- React + Vite + TypeScript.
- Supabase backend.
- Tailwind CSS.
- Light Premium Fintech visual theme.
- Admin-first implementation, followed by client portal.
- Admin manually enters portfolio holdings, prices, cash and liabilities.
- Manual contribution recording; no payment gateway initially.
- No broker API initially.
- Razorpay selected for future evaluation, not V1.
- Zerodha Kite Connect selected for future evaluation, not V1.
- Profit-sharing percentage configurable by admin per investment cycle.
- Unit-based NAV accounting.
- Withdrawals to be designed later.
- Claude implements module-by-module and reports progress after each module, waiting for approval.

## Still to decide before production financial accounting
1. Exact investment/legal structure and whether the activity may be conducted as proposed.
2. Whether funds are actually pooled and who legally owns/custodies the assets.
3. Whether admin is investing personal funds alongside others.
4. Exact performance-fee policy and whether the fee is calculated per investor, per contribution lot, or using another approved equalisation method.
5. High-water mark reset, loss carry-forward and fee crystallisation timing.
6. Treatment of expenses, brokerage, taxes, cash, dividends, corporate actions and realised/unrealised P&L.
7. Whether clients may add capital after the initial contribution and under what rules.
8. Withdrawal / redemption process and valuation cut-off.
9. Whether Razorpay will approve the precise business category and payment flow.
10. Whether Zerodha's account/API terms and market-data terms permit the intended future use.

## Razorpay pricing note (checked 12 Nov 2026)
Razorpay's published standard pricing page currently advertises:
- 2% platform/payment-gateway fee plus applicable GST for standard payment gateway transactions.
- No setup fee.
- No annual maintenance charge.
- Pricing can vary by product, payment method, business category, negotiated plan and eligibility.
- The page describes a 0% MDR policy for standard bank-to-bank UPI but also states a 2% platform/technology fee; do not interpret this as free processing.
- Razorpay must approve the actual business use case. Do not enable payments merely because the technical integration works.

Official source: https://razorpay.com/pricing/

Because Razorpay is not included in V1, there is no Razorpay transaction fee during V1 development/testing. Test-mode use and any account-specific terms should still be checked with Razorpay before launch.

## Zerodha note
Kite Connect has a free Personal tier with limited market-data features and a paid Connect tier listed at ₹500/month per API key for live WebSocket market data and historical candles. Zerodha's documentation says there is no sandbox environment. The API is not CORS-enabled and credentials must stay server-side. Terms and suitability for this specific business must be confirmed before integration.

Official sources:
- https://zerodha.com/products/api/
- https://kite.trade/docs/connect/v3/
- https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/kite-connect-api-faqs

## Legal/product boundary
A friends-only group does not automatically remove regulatory requirements. The app may be built as a fictional-data prototype and internal recordkeeping demo. Do not accept or manage real client money, market the arrangement, promise returns, or connect live payment/broker services until qualified Indian securities counsel and the relevant providers have reviewed the exact structure.
