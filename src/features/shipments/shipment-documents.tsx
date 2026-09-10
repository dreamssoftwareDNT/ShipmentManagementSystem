'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Upload } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiClient } from '@/lib/api/client';
import { formatDate, humanise } from '@/utils/format';
import { DocumentType } from '@/types/enums';

export interface ShipmentDocumentRow {
  id: string;
  documentType: string;
  title: string;
  fileName: string;
  fileSize: number;
  version: number;
  createdAt: string;
}

const ACCEPTED =
  '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';

function readableSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1_048_576) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function ShipmentDocuments({
  shipmentId,
  documents,
  canUpload,
  canDelete,
}: {
  shipmentId: string;
  documents: ShipmentDocumentRow[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>(DocumentType.BILL_OF_LADING);
  const [title, setTitle] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setError('Choose a file to upload.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = new FormData();
    payload.set('file', file);
    payload.set('documentType', documentType);
    payload.set('title', title || file.name);

    if (issuedDate) {
      payload.set('issuedDate', issuedDate);
    }

    try {
      await apiClient.upload(`/shipments/${shipmentId}/documents`, payload);
      toast.success('Document uploaded', title || file.name);
      setOpen(false);
      setTitle('');
      setIssuedDate('');

      if (fileRef.current) {
        fileRef.current.value = '';
      }

      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The document could not be uploaded.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (documentId: string, name: string) => {
    try {
      await apiClient.delete(`/documents/${documentId}`);
      toast.success('Document removed', name);
      router.refresh();
    } catch (cause) {
      toast.error('Could not remove document', cause instanceof ApiError ? cause.message : undefined);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Documents"
          description="Bills of lading, packing lists, customs paperwork and certificates."
          actions={
            canUpload ? (
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                <Upload className="size-4" aria-hidden />
                Upload
              </Button>
            ) : null
          }
        />

        {documents.length === 0 ? (
          <EmptyState
            title="No documents attached"
            description="Upload the shipping paperwork so it travels with the job."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-ink">{document.title}</p>
                    <Badge tone="neutral">{humanise(document.documentType)}</Badge>
                    {document.version > 1 ? <Badge tone="info">v{document.version}</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-ink-muted">
                    {document.fileName} · {readableSize(document.fileSize)} ·{' '}
                    {formatDate(document.createdAt)}
                  </p>
                </div>

                <a
                  href={`/api/documents/${document.id}/download`}
                  className="text-ink-muted transition-colors hover:text-brand"
                  aria-label={`Download ${document.title}`}
                >
                  <Download className="size-4" aria-hidden />
                </a>

                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => remove(document.id, document.title)}
                    className="text-ink-muted transition-colors hover:text-critical"
                    aria-label={`Remove ${document.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload a document"
        description="PDF, image, Word and Excel files up to 15 MB."
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={upload} loading={submitting}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Document type" htmlFor="documentType">
            <Select
              id="documentType"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              {Object.values(DocumentType).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Title" htmlFor="title" hint="Defaults to the file name">
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>

          <Field label="Issued date" htmlFor="issuedDate">
            <Input
              id="issuedDate"
              type="date"
              value={issuedDate}
              onChange={(event) => setIssuedDate(event.target.value)}
            />
          </Field>

          <Field label="File" htmlFor="file" required>
            <input
              id="file"
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-xs file:font-medium"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
