import { jsonObject, type AuditEntry } from '@/features/audit/api';
import { formatINR, formatNav, formatRateAsPercent, formatUnits } from '@/lib/format';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Plain-language description of a contribution audit entry. */
export function describeContributionEntry(
  e: Pick<AuditEntry, 'action' | 'before_data' | 'after_data'>,
): string {
  const after = jsonObject(e.after_data);
  switch (e.action) {
    case 'contribution.recorded':
      return `Recorded ${formatINR(s(after.amount))} (pending verification)`;
    case 'contribution.verified':
      return `Verified: ${formatUnits(s(after.units_issued))} units issued at NAV ${formatNav(
        s(after.applicable_nav),
        {
          decimals: 8,
        },
      )}, fee rate ${formatRateAsPercent(s(after.fee_rate))} locked`;
    case 'contribution.rejected':
      return 'Rejected — no units issued';
    case 'contribution.reversed':
      return `Reversed: ${formatUnits(s(after.units_reversed))} units removed by a reversing entry`;
    default:
      return e.action;
  }
}
