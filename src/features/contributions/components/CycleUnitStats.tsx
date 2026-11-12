import { Link } from 'react-router';
import { StatCard } from '@/components/ui/StatCard';
import { formatINR, formatUnits } from '@/lib/format';
import { useCycleUnitSummary } from '../queries';

/** Unit and contribution totals for a cycle (from the append-only ledger). */
export function CycleUnitStats({ cycleId }: { cycleId: string }) {
  const { data, isPending } = useCycleUnitSummary(cycleId);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label="Outstanding units"
        term="outstandingUnits"
        loading={isPending}
        value={formatUnits(data?.outstanding_units ?? '0', { decimals: 4 })}
        meta={`${data?.investor_count ?? 0} investor(s)`}
      />
      <StatCard
        label="Net verified contributions"
        loading={isPending}
        value={formatINR(data?.net_contributed ?? '0')}
        meta="After reversals"
      />
      <StatCard
        label="Pending verification"
        loading={isPending}
        value={formatINR(data?.pending_amount ?? '0')}
        meta={
          data && data.pending_count > 0 ? (
            <Link
              to={`/admin/contributions?status=pending&cycle=${cycleId}`}
              className="text-emerald-700 hover:underline"
            >
              {data.pending_count} to review
            </Link>
          ) : (
            'Nothing to review'
          )
        }
      />
    </div>
  );
}
