'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { StatusPill } from '@/components/ui/status-pill';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { ShipmentStatus, ShipmentType, TransportMode } from '@/types/enums';
import { ShipmentFormDialog } from './shipment-form';

export interface ShipmentRow {
  id: string;
  shipmentNo: string;
  status: string;
  shipmentType: string;
  transportMode: string;
  originPort: string;
  destinationPort: string;
  shippingDate: string | null;
  expectedArrival: string | null;
  actualRevenue: string;
  actualCost: string;
  customer: { id: string; name: string; code: string } | null;
  carrier: { id: string; name: string } | null;
}

export function ShipmentList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: status || undefined,
      transportMode: mode || undefined,
      shipmentType: type || undefined,
    }),
    [status, mode, type],
  );

  const resource = usePagedResource<ShipmentRow>('/shipments', { filters });

  const columns: Array<DataTableColumn<ShipmentRow>> = [
    {
      key: 'shipmentNo',
      header: 'Shipment',
      sortable: true,
      width: '160px',
      cell: (row) => (
        <Link
          href={`/shipments/${row.id}`}
          className="font-medium text-brand hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.shipmentNo}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.customer?.name ?? '--'}</p>
          <p className="truncate text-xs text-ink-muted">{humanise(row.shipmentType)}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">
            {row.originPort} <span className="text-ink-subtle">to</span> {row.destinationPort}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {humanise(row.transportMode)}
            {row.carrier ? ` · ${row.carrier.name}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'shippingDate',
      header: 'Shipped',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.shippingDate),
    },
    {
      key: 'expectedArrival',
      header: 'ETA',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.expectedArrival),
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      width: '120px',
      cell: (row) => {
        const revenue = Number.parseFloat(row.actualRevenue ?? '0');
        const cost = Number.parseFloat(row.actualCost ?? '0');
        const profit = revenue - cost;

        if (revenue === 0 && cost === 0) {
          return <span className="text-ink-subtle">--</span>;
        }

        return (
          <span className={profit < 0 ? 'font-medium text-critical' : 'font-medium text-positive'}>
            {formatAmount(profit)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Stage',
      width: '150px',
      cell: (row) => <StatusPill status={row.status} />,
    },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        onRowClick={(row) => router.push(`/shipments/${row.id}`)}
        searchPlaceholder="Search by shipment, booking, bill of lading, port or vessel"
        emptyTitle="No shipments found"
        emptyDescription="Adjust the filters, or book the first shipment."
        filters={
          <>
            <Select
              aria-label="Filter by stage"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-40"
            >
              <option value="">All stages</option>
              {Object.values(ShipmentStatus).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by mode"
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="w-36"
            >
              <option value="">All modes</option>
              {Object.values(TransportMode).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="w-36"
            >
              <option value="">All types</option>
              {Object.values(ShipmentType).map((value) => (
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
              New shipment
            </Button>
          ) : null
        }
      />

      <ShipmentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => router.push(`/shipments/${id}`)}
      />
    </>
  );
}
