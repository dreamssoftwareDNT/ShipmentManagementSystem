import { Badge, type BadgeTone } from './badge';
import { humanise } from '@/utils/format';

const STATUS_TONES: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  COMPLETED: 'positive',
  CANCELLED: 'critical',

  BOOKING_CONFIRMED: 'info',
  CARGO_RECEIVED: 'info',
  DOCUMENTATION: 'warning',
  IN_TRANSIT: 'brand',
  CUSTOM_CLEARANCE: 'warning',
  DELIVERED: 'positive',
  CLOSED: 'neutral',

  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'positive',
  OVERDUE: 'critical',
  POSTED: 'positive',

  ACTIVE: 'positive',
  INACTIVE: 'neutral',
  SUSPENDED: 'critical',
  BLOCKED: 'critical',

  RECORDED: 'neutral',
  REJECTED: 'critical',
};

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <Badge tone="neutral">Unknown</Badge>;
  }

  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{humanise(status)}</Badge>;
}
