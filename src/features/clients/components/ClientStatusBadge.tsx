import { Badge } from '@/components/ui/Badge';
import type { ProfileStatus } from '@/features/auth/types';

export function ClientStatusBadge({ status }: { status: ProfileStatus }) {
  return status === 'active' ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>;
}
