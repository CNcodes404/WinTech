import { History } from 'lucide-react';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { useEntityHistory, type AuditEntityType, type AuditEntry } from './api';

interface EntityHistoryProps {
  entityType: AuditEntityType;
  entityId: string;
  /** Turns an audit entry into a plain-language sentence. */
  describe: (entry: AuditEntry) => string;
}

export function EntityHistory({ entityType, entityId, describe }: EntityHistoryProps) {
  const { data, isPending, isError, refetch } = useEntityHistory(entityType, entityId);

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
    return <ErrorState message="The history could not be loaded." onRetry={() => void refetch()} />;
  }
  if (data.length === 0) return <EmptyState icon={History} title="No history yet" />;

  return (
    <ol className="divide-y divide-line">
      {data.map((e) => (
        <li key={e.id} className="px-5 py-3">
          <p className="text-sm font-medium">{describe(e)}</p>
          {e.reason && <p className="mt-0.5 text-sm break-words text-muted">Reason: {e.reason}</p>}
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
