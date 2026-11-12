import { CircleCheck, CircleX, History, Pencil } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { VALUATION_STATUS_LABEL, type ValuationStatus } from '../types';

const STYLE: Record<ValuationStatus, { tone: BadgeTone; icon: typeof Pencil }> = {
  draft: { tone: 'warning', icon: Pencil },
  approved: { tone: 'success', icon: CircleCheck },
  superseded: { tone: 'neutral', icon: History },
  discarded: { tone: 'danger', icon: CircleX },
};

export function ValuationStatusBadge({ status }: { status: ValuationStatus }) {
  return (
    <Badge tone={STYLE[status].tone} icon={STYLE[status].icon}>
      {VALUATION_STATUS_LABEL[status]}
    </Badge>
  );
}
