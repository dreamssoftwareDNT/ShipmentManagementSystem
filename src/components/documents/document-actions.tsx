'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Printer, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiClient } from '@/lib/api/client';

export interface InvoiceActionConfig {
  basePath: string;
  documentId: string;
  status: string;
  canIssue?: boolean;
  canCancel?: boolean;
  issueLabel?: string;
  issuePath?: string;
}

/**
 * Shared action bar for every posted document. Cancellation always demands a
 * reason because it writes reversal entries into the party statement.
 */
export function DocumentActions({
  basePath,
  documentId,
  status,
  canIssue = false,
  canCancel = false,
  issueLabel = 'Issue invoice',
  issuePath = 'issue',
}: InvoiceActionConfig) {
  const router = useRouter();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = status === 'DRAFT';
  const isCancelled = status === 'CANCELLED';

  const issue = async () => {
    setBusy(true);

    try {
      await apiClient.post(`${basePath}/${documentId}/${issuePath}`);
      toast.success('Document issued', 'It now appears on the party statement.');
      router.refresh();
    } catch (cause) {
      toast.error('Could not issue', cause instanceof ApiError ? cause.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (reason.trim().length === 0) {
      setError('Enter a reason for the cancellation.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiClient.post(`${basePath}/${documentId}/cancel`, { reason });
      toast.success('Document cancelled', 'Reversal entries were written to the ledger.');
      setCancelOpen(false);
      setReason('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The document could not be cancelled.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
          <Printer className="size-4" aria-hidden />
          Print
        </Button>

        {canIssue && isDraft ? (
          <Button size="sm" onClick={issue} loading={busy}>
            <Send className="size-4" aria-hidden />
            {issueLabel}
          </Button>
        ) : null}

        {canCancel && !isCancelled ? (
          <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
            <Ban className="size-4 text-critical" aria-hidden />
            Cancel
          </Button>
        ) : null}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this document"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={cancel} loading={busy}>
              Cancel document
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-ink-muted">
            Any ledger entries already posted for this document are reversed. The document itself is
            kept for the audit trail.
          </p>
          <Field label="Reason" htmlFor="cancelReason" required>
            <Textarea
              id="cancelReason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Duplicate of INV-2026-000123"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
