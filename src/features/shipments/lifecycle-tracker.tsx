'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, CircleSlash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiClient } from '@/lib/api/client';
import { cn } from '@/utils/cn';
import { humanise } from '@/utils/format';
import { SHIPMENT_STATUS_SEQUENCE, ShipmentStatus } from '@/types/enums';

export function LifecycleTracker({
  shipmentId,
  currentStatus,
  canAdvance,
}: {
  shipmentId: string;
  currentStatus: string;
  canAdvance: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancelled = currentStatus === ShipmentStatus.CANCELLED;
  const currentIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(currentStatus as ShipmentStatus);
  const nextStatus = currentIndex >= 0 ? SHIPMENT_STATUS_SEQUENCE[currentIndex + 1] : undefined;

  const changeStatus = async (status: string) => {
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/shipments/${shipmentId}/status`, {
        status,
        remarks: remarks || undefined,
        occurredAt: occurredAt || undefined,
      });

      toast.success('Stage updated', humanise(status));
      setDialogOpen(false);
      setCancelOpen(false);
      setRemarks('');
      setOccurredAt('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The stage could not be changed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ol className="flex flex-wrap items-center gap-y-2">
        {SHIPMENT_STATUS_SEQUENCE.map((status, index) => {
          const done = !isCancelled && currentIndex >= index;
          const active = currentStatus === status;

          return (
            <li key={status} className="flex items-center">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border text-[0.625rem] font-semibold',
                    done
                      ? 'border-brand bg-brand text-white'
                      : 'border-border-strong bg-surface text-ink-subtle',
                    active && 'ring-2 ring-brand/25',
                  )}
                >
                  {done ? <Check className="size-3" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    active ? 'font-semibold text-ink' : 'text-ink-muted',
                  )}
                >
                  {humanise(status)}
                </span>
              </div>
              {index < SHIPMENT_STATUS_SEQUENCE.length - 1 ? (
                <ChevronRight className="mx-1.5 size-3.5 text-border-strong" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {isCancelled ? (
        <Alert tone="error" className="mt-3">
          This shipment was cancelled and can no longer move through the lifecycle.
        </Alert>
      ) : canAdvance ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {nextStatus ? (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Advance to {humanise(nextStatus).toLowerCase()}
            </Button>
          ) : null}
          {currentStatus !== ShipmentStatus.CLOSED && currentStatus !== ShipmentStatus.DELIVERED ? (
            <Button size="sm" variant="secondary" onClick={() => setCancelOpen(true)}>
              <CircleSlash className="size-4" aria-hidden />
              Cancel shipment
            </Button>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={`Advance to ${nextStatus ? humanise(nextStatus).toLowerCase() : ''}`}
        description="The stage change is recorded in the shipment history and tracking feed."
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              onClick={() => (nextStatus ? changeStatus(nextStatus) : undefined)}
            >
              Confirm stage
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Occurred at" htmlFor="occurredAt" hint="Defaults to now">
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </Field>

          <Field label="Remarks" htmlFor="remarks">
            <Textarea
              id="remarks"
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Vessel departed on schedule"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this shipment"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={submitting}>
              Keep shipment
            </Button>
            <Button
              variant="danger"
              loading={submitting}
              onClick={() => changeStatus(ShipmentStatus.CANCELLED)}
            >
              Cancel shipment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-ink-muted">
            Cancelling stops the shipment permanently. Any invoices already raised against it must
            be cancelled separately.
          </p>
          <Field label="Reason" htmlFor="cancelRemarks">
            <Textarea
              id="cancelRemarks"
              rows={3}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
