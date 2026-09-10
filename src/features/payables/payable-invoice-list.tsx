'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions, type OptionSet } from '@/hooks/use-options';
import { formatAmount, formatDate } from '@/utils/format';
import { InvoiceStatus } from '@/types/enums';

export interface PayableInvoiceRow {
  id: string;
  invoiceNo: string;
  vendorRefNo?: string | null;
  agentRefNo?: string | null;
  status: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  grandTotal: string;
  paidAmount: string;
  balanceAmount: string;
  vendor?: { id: string; name: string } | null;
  clearingAgent?: { id: string; name: string } | null;
  shipment?: { id: string; shipmentNo: string } | null;
}

export interface PayableListConfig {
  endpoint: string;
  partyLabel: string;
  partyOptionSet: OptionSet;
  createLabel: string;
}

export function PayableInvoiceList({
  config,
  canCreate,
  onCreate,
  dialog,
}: {
  config: PayableListConfig;
  canCreate: boolean;
  onCreate: () => void;
  dialog: (refresh: () => void) => ReactNode;
}) {
  const [status, setStatus] = useState('');
  const [partyId, setPartyId] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { options: parties } = useOptions(config.partyOptionSet);
  const filters = useMemo(
    () => ({
      status: status || undefined,
      partyId: partyId || undefined,
      overdueOnly: overdueOnly || undefined,
    }),
    [status, partyId, overdueOnly],
  );

  const resource = usePagedResource<PayableInvoiceRow>(config.endpoint, { filters });

  const columns: Array<DataTableColumn<PayableInvoiceRow>> = [
    {
      key: 'invoiceNo',
      header: 'Invoice',
      sortable: true,
      width: '150px',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{row.invoiceNo}</p>
          {row.vendorRefNo || row.agentRefNo ? (
            <p className="truncate text-xs text-ink-muted">
              Their ref {row.vendorRefNo ?? row.agentRefNo}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'party',
      header: config.partyLabel,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.vendor?.name ?? row.clearingAgent?.name ?? '--'}</p>
          {row.shipment ? (
            <p className="truncate text-xs text-ink-muted">{row.shipment.shipmentNo}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'invoiceDate',
      header: 'Received',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.invoiceDate),
    },
    {
      key: 'dueDate',
      header: 'Due',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => {
        const overdue =
          new Date(row.dueDate) < new Date() &&
          ['PENDING', 'PARTIAL', 'OVERDUE'].includes(row.status);

        return <span className={overdue ? 'text-critical' : undefined}>{formatDate(row.dueDate)}</span>;
      },
    },
    {
      key: 'grandTotal',
      header: 'Invoiced',
      align: 'right',
      width: '130px',
      cell: (row) => `${row.currencyCode} ${formatAmount(row.grandTotal)}`,
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      align: 'right',
      width: '110px',
      cell: (row) => formatAmount(row.paidAmount),
    },
    {
      key: 'balanceAmount',
      header: 'Balance',
      align: 'right',
      width: '120px',
      cell: (row) => (
        <span className={Number(row.balanceAmount) > 0 ? 'font-medium text-ink' : 'text-ink-subtle'}>
          {formatAmount(row.balanceAmount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search by invoice number, reference, party or shipment"
        emptyTitle="No invoices found"
        filters={
          <>
            <Select
              aria-label={`Filter by ${config.partyLabel.toLowerCase()}`}
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              className="w-48"
            >
              <option value="">All {config.partyLabel.toLowerCase()}s</option>
              {parties.map((option) => (
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
              {Object.values(InvoiceStatus).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>

            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
              />
              Overdue only
            </label>
          </>
        }
        actions={
          canCreate ? (
            <Button onClick={onCreate}>
              <Plus className="size-4" aria-hidden />
              {config.createLabel}
            </Button>
          ) : null
        }
      />

      {dialog(resource.refresh)}
    </>
  );
}
