import { History } from 'lucide-react';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { describeEntry } from '../history';
import { useClientHistory } from '../queries';

export function ClientHistory({ clientId }: { clientId: string }) {
  const { data, isPending, isError, refetch } = useClientHistory(clientId);

  if (isPending) {
    return (
      <LoadingRegion label="Loading history">
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (isError) {
    return <ErrorState message="The account history could not be loaded." onRetry={() => void refetch()} />;
  }
  if (data.length === 0) return <EmptyState icon={History} title="No history yet" />;

  return (
    <ol className="divide-y divide-line">
      {data.map((e) => (
        <li key={e.id} className="px-5 py-3">
          <p className="text-sm font-medium">{describeEntry(e)}</p>
          {e.reason && <p className="mt-0.5 text-sm text-muted">Reason: {e.reason}</p>}
          <p className="mt-0.5 text-xs text-muted">
            <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
            {' · '}
            {e.actor ? `by ${e.actor.full_name || e.actor.email}` : 'by system / project owner'}
          </p>
        </li>
      ))}
    </ol>
  );
}
