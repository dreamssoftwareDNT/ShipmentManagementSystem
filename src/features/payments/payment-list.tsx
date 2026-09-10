'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions } from '@/hooks/use-options';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { PaymentMethod } from '@/types/enums';
import { PaymentFormDialog, type PaymentModuleConfig } from './payment-form';

export interface PaymentRow {
  id: string;
  paymentNo?: string;
  receiptNo?: string;
  paymentDate: string;
  paymentMethod: string;
  currencyCode: string;
  amount: string;
  allocatedAmount: string;
  status: string;
  referenceNo: string | null;
  vendor?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  clearingAgent?: { id: string; name: string } | null;
}

export function PaymentList({
  config,
  canCreate,
  documentLabel,
}: {
  config: PaymentModuleConfig;
  canCreate: boolean;
  documentLabel: string;
}) {
  const [partyId, setPartyId] = useState('');
  const [method, setMethod] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { options: parties } = useOptions(config.partyOptionSet);
  const filters = useMemo(
    () => ({ partyId: partyId || undefined, paymentMethod: method || undefined }),
    [partyId, method],
  );

  const resource = usePagedResource<PaymentRow>(config.endpoint, { filters });

  const columns: Array<DataTableColumn<PaymentRow>> = [
    {
      key: 'reference',
      header: documentLabel,
      width: '150px',
      cell: (row) => (
        <span className="font-medium text-ink">{row.paymentNo ?? row.receiptNo ?? '--'}</span>
      ),
    },
    {
      key: 'party',
      header: config.partyLabel,
      cell: (row) => row.vendor?.name ?? row.customer?.name ?? row.clearingAgent?.name ?? '--',
    },
    {
      key: 'paymentDate',
      header: 'Date',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.paymentDate),
    },
    {
      key: 'paymentMethod',
      header: 'Method',
      width: '140px',
      cell: (row) => humanise(row.paymentMethod),
    },
    {
      key: 'referenceNo',
      header: 'Reference',
      cell: (row) => <span className="text-ink-muted">{row.referenceNo ?? '--'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '130px',
      cell: (row) => `${row.currencyCode} ${formatAmount(row.amount)}`,
    },
    {
      key: 'allocatedAmount',
      header: 'Allocated',
      align: 'right',
      width: '120px',
      cell: (row) => {
        const onAccount = Number(row.amount) - Number(row.allocatedAmount);

        return (
          <div>
            <p>{formatAmount(row.allocatedAmount)}</p>
            {onAccount > 0.005 && row.status !== 'CANCELLED' ? (
              <p className="text-xs text-warning">{formatAmount(onAccount)} on account</p>
            ) : null}
          </div>
        );
      },
    },
    { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search by reference, cheque number or party"
        emptyTitle="No payments recorded"
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
              aria-label="Filter by method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-44"
            >
              <option value="">All methods</option>
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </>
        }
        actions={
          canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              {config.title}
            </Button>
          ) : null
        }
      />

      <PaymentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={resource.refresh}
        config={config}
      />
    </>
  );
}
