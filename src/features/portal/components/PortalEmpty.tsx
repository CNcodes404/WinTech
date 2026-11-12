import { Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { formatDateTime, formatINR } from '@/lib/format';
import { useMyContributions } from '../api';

/** Shown until the client's first contribution has been verified. */
export function PortalEmpty() {
  const contributions = useMyContributions();
  const pending = contributions.data?.filter((c) => c.status === 'pending') ?? [];
  return (
    <Card>
      <EmptyState
        icon={Wallet}
        title="No verified investment yet"
        description="Your investment appears here once the administrator verifies your first contribution and issues units."
      />
      {pending.length > 0 && (
        <div className="border-t border-line px-5 py-4">
          <h2 className="text-sm">Awaiting verification</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {pending.map((p) => (
              <li key={p.id} className="num">
                {formatINR(p.amount)} received {formatDateTime(p.received_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
