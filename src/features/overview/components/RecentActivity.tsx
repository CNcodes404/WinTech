import { History } from 'lucide-react';
import { Link } from 'react-router';
import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';
import { useRecentActivity } from '../api';
import { activityLink, describeActivity } from '../logic';

export function RecentActivity() {
  const { data, isPending, isError, refetch } = useRecentActivity();
  if (isPending) {
    return (
      <LoadingRegion label="Loading activity">
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (isError)
    return <ErrorState message="Recent activity could not be loaded." onRetry={() => void refetch()} />;
  if (data.length === 0) return <EmptyState icon={History} title="No activity yet" />;

  return (
    <ol className="divide-y divide-line">
      {data.map((e) => {
        const href = activityLink(e);
        const text = describeActivity(e);
        return (
          <li key={e.id} className="px-5 py-3">
            {href ? (
              <Link to={href} className="text-sm font-medium hover:underline">
                {text}
              </Link>
            ) : (
              <p className="text-sm font-medium">{text}</p>
            )}
            <p className="mt-0.5 text-xs text-muted">
              <time dateTime={e.created_at}>{formatDateTime(e.created_at)}</time>
              {' · '}
              {e.actor ? e.actor.full_name || e.actor.email : 'system / project owner'}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
