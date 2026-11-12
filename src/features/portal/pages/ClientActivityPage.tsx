import { History } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { useMyActivity } from '../api';
import { describeClientActivity } from '../logic';

export function ClientActivityPage() {
  const { data, isPending, isError, refetch } = useMyActivity();
  return (
    <>
      <PageHeader
        title="Activity"
        description="Your contributions, unit issues and published NAVs, newest first."
      />
      <Card>
        {isPending ? (
          <TableSkeleton rows={6} columns={2} />
        ) : isError ? (
          <ErrorState message="Your activity could not be loaded." onRetry={() => void refetch()} />
        ) : data.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" />
        ) : (
          <ol className="divide-y divide-line">
            {data.map((a, i) => (
              <li
                key={`${a.kind}-${a.occurred_at}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3"
              >
                <span className="text-sm">
                  {describeClientActivity(a)}
                  <span className="ml-2 text-xs text-muted">{a.cycle_name}</span>
                </span>
                <time dateTime={a.occurred_at} className="num text-xs text-muted">
                  {formatDateTime(a.occurred_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
