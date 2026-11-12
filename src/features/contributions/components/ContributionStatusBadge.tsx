import { CircleCheck, CircleX, Clock, Undo2 } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { ContributionStatus } from '../types';

const STYLE: Record<ContributionStatus, { tone: BadgeTone; label: string; icon: typeof Clock }> = {
  pending: { tone: 'warning', label: 'Pending', icon: Clock },
  verified: { tone: 'success', label: 'Verified', icon: CircleCheck },
  rejected: { tone: 'danger', label: 'Rejected', icon: CircleX },
  reversed: { tone: 'neutral', label: 'Reversed', icon: Undo2 },
};

export function ContributionStatusBadge({ status }: { status: ContributionStatus }) {
  const s = STYLE[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}
