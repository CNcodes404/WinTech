/**
 * Where clients send money (shown on Client → Add funds).
 *
 * TODO(owner): replace with the real details before using real money:
 *   1. Put your UPI QR image in /public (e.g. /public/payment-qr.png) and set `qrImage`.
 *   2. Set `upiId` and `payeeName`.
 *   3. Optionally fill `bank` for NEFT/RTGS/IMPS; leave fields empty to hide them.
 *   4. Set `isDemo` to false (removes the "demo" warning).
 */
export const PAYMENT_DETAILS = {
  isDemo: true,
  qrImage: '/payment-qr-demo.svg',
  upiId: 'wintech.demo@upi',
  payeeName: 'WINTECH',
  bank: {
    accountName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
  },
};

/** UPI deep link that opens a UPI app on phones with the payee (and amount, if given) filled in. */
export function upiPayLink(amount?: string): string {
  const p = new URLSearchParams({ pa: PAYMENT_DETAILS.upiId, pn: PAYMENT_DETAILS.payeeName, cu: 'INR' });
  if (amount && /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0) p.set('am', amount);
  p.set('tn', 'WINTECH investment');
  return `upi://pay?${p.toString()}`;
}
