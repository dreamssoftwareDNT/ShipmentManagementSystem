'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { ConfirmDialog } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { ApiError, apiClient } from '@/lib/api/client';
import { PartyStatus } from '@/types/enums';

export interface SimplePartyRow {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: string;
  licenseNumber?: string | null;
  portOfOperation?: string | null;
  currencyCode?: string;
  paymentTermDays?: number;
}

export interface SimplePartyConfig {
  endpoint: string;
  entityLabel: string;
  createLabel: string;
  ledgerPartyType?: string;
  extraColumns?: Array<DataTableColumn<SimplePartyRow>>;
  searchPlaceholder: string;
}

export function SimplePartyModule({
  config,
  permissions,
  renderDialog,
}: {
  config: SimplePartyConfig;
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
  renderDialog: (args: {
    open: boolean;
    record: SimplePartyRow | null;
    onClose: () => void;
    onSaved: () => void;
  }) => ReactNode;
}) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SimplePartyRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SimplePartyRow | null>(null);
  const [busy, setBusy] = useState(false);

  const filters = useMemo(() => ({ status: status || undefined }), [status]);
  const resource = usePagedResource<SimplePartyRow>(config.endpoint, {
    filters,
    initialSortBy: 'name',
    initialSortDirection: 'asc',
  });

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setBusy(true);

    try {
      await apiClient.delete(`${config.endpoint}/${pendingDelete.id}`);
      toast.success(`${config.entityLabel} archived`, pendingDelete.name);
      setPendingDelete(null);
      resource.refresh();
    } catch (error) {
      toast.error('Could not archive', error instanceof ApiError ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<DataTableColumn<SimplePartyRow>> = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      width: '120px',
      cell: (row) =>
        config.ledgerPartyType ? (
          <Link
            href={`/ledgers?partyType=${config.ledgerPartyType}&partyId=${row.id}`}
            className="font-medium text-brand hover:underline"
          >
            {row.code}
          </Link>
        ) : (
          <span className="font-medium">{row.code}</span>
        ),
    },
    {
      key: 'name',
      header: config.entityLabel,
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          {row.companyName ? <p className="truncate text-xs text-ink-muted">{row.companyName}</p> : null}
        </div>
      ),
    },
    ...(config.extraColumns ?? []),
    {
      key: 'contactPerson',
      header: 'Contact',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.contactPerson ?? '--'}</p>
          {row.phone ? <p className="truncate text-xs text-ink-muted">{row.phone}</p> : null}
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Location',
      cell: (row) => [row.city, row.country].filter(Boolean).join(', ') || '--',
    },
    { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '92px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {permissions.canUpdate ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${row.name}`}
              onClick={() => {
                setEditing(row);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" aria-hidden />
            </Button>
          ) : null}
          {permissions.canDelete ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Archive ${row.name}`}
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 className="size-4 text-critical" aria-hidden />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder={config.searchPlaceholder}
        emptyTitle={`No ${config.entityLabel.toLowerCase()}s found`}
        filters={
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-36"
          >
            <option value="">All statuses</option>
            {Object.values(PartyStatus).map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        }
        actions={
          permissions.canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {config.createLabel}
            </Button>
          ) : null
        }
      />

      {renderDialog({
        open: formOpen,
        record: editing,
        onClose: () => setFormOpen(false),
        onSaved: resource.refresh,
      })}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={busy}
        destructive
        title={`Archive this ${config.entityLabel.toLowerCase()}?`}
        confirmLabel="Archive"
        message={`${pendingDelete?.name ?? ''} will be hidden from selection lists. Historic records are kept.`}
      />
    </>
  );
}
