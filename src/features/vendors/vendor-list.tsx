'use client';

import { useMemo, useState } from 'react';
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
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { PartyStatus } from '@/types/enums';
import { VendorFormDialog, type VendorRecord } from './vendor-form';

export interface VendorRow {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  vendorTypeId: string;
  contactPerson: string | null;
  email: string | null;
  country: string | null;
  currencyCode: string;
  paymentTermDays: number;
  status: string;
}

export function VendorList({
  permissions,
}: {
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [vendorTypeId, setVendorTypeId] = useState('');
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { options: vendorTypes } = useOptions('vendorTypes');
  const typeNames = useMemo(
    () => new Map(vendorTypes.map((option) => [option.value, option.label])),
    [vendorTypes],
  );

  const filters = useMemo(
    () => ({ status: status || undefined, vendorTypeId: vendorTypeId || undefined }),
    [status, vendorTypeId],
  );

  const resource = usePagedResource<VendorRow>('/vendors', {
    filters,
    initialSortBy: 'name',
    initialSortDirection: 'asc',
  });

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);

    try {
      await apiClient.delete(`/vendors/${pendingDelete.id}`);
      toast.success('Vendor archived', pendingDelete.name);
      setPendingDelete(null);
      resource.refresh();
    } catch (error) {
      toast.error('Could not archive vendor', error instanceof ApiError ? error.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Array<DataTableColumn<VendorRow>> = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      width: '120px',
      cell: (row) => (
        <Link href={`/ledgers?partyType=VENDOR&partyId=${row.id}`} className="font-medium text-brand hover:underline">
          {row.code}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Vendor',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          {row.companyName ? <p className="truncate text-xs text-ink-muted">{row.companyName}</p> : null}
        </div>
      ),
    },
    {
      key: 'vendorTypeId',
      header: 'Type',
      cell: (row) => typeNames.get(row.vendorTypeId) ?? '--',
    },
    {
      key: 'contactPerson',
      header: 'Contact',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.contactPerson ?? '--'}</p>
          {row.email ? <p className="truncate text-xs text-ink-muted">{row.email}</p> : null}
        </div>
      ),
    },
    { key: 'country', header: 'Country', sortable: true, cell: (row) => row.country ?? '--' },
    { key: 'currencyCode', header: 'Currency', align: 'center', width: '90px', cell: (row) => row.currencyCode },
    {
      key: 'paymentTermDays',
      header: 'Terms',
      align: 'right',
      width: '90px',
      cell: (row) => `${row.paymentTermDays} days`,
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
                setEditing(row as unknown as VendorRecord);
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
        searchPlaceholder="Search by vendor, company, email or country"
        emptyTitle="No vendors found"
        filters={
          <>
            <Select
              aria-label="Filter by type"
              value={vendorTypeId}
              onChange={(event) => setVendorTypeId(event.target.value)}
              className="w-44"
            >
              <option value="">All vendor types</option>
              {vendorTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

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
          </>
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
              New vendor
            </Button>
          ) : null
        }
      />

      <VendorFormDialog
        open={formOpen}
        vendor={editing}
        onClose={() => setFormOpen(false)}
        onSaved={resource.refresh}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        destructive
        title="Archive this vendor?"
        confirmLabel="Archive"
        message={`${pendingDelete?.name ?? ''} will be hidden from selection lists. Historic invoices and payments are kept.`}
      />
    </>
  );
}
