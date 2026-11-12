import { CircleCheck, CircleX, History, Pencil } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { NAV_STATUS_LABEL, type NavStatus } from '../types';

const STYLE: Record<NavStatus, { tone: BadgeTone; icon: typeof Pencil }> = {
  draft: { tone: 'warning', icon: Pencil },
  published: { tone: 'success', icon: CircleCheck },
  corrected: { tone: 'neutral', icon: History },
  discarded: { tone: 'danger', icon: CircleX },
};

export function NavStatusBadge({ status }: { status: NavStatus }) {
  return (
    <Badge tone={STYLE[status].tone} icon={STYLE[status].icon}>
      {NAV_STATUS_LABEL[status]}
    </Badge>
  );
}
