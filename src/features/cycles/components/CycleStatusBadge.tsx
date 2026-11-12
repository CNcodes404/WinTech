import { CircleCheck, CircleDot, Lock, Pencil, PlayCircle } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { STATUS_LABEL, type CycleStatus } from '../types';

const STYLE: Record<CycleStatus, { tone: BadgeTone; icon: typeof CircleDot }> = {
  draft: { tone: 'neutral', icon: Pencil },
  open: { tone: 'info', icon: CircleDot },
  active: { tone: 'success', icon: PlayCircle },
  closed: { tone: 'warning', icon: Lock },
  settled: { tone: 'neutral', icon: CircleCheck },
};

export function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const s = STYLE[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
