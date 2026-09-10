'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ban, CheckCircle2, Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { DocumentLineEditor } from '@/components/forms/document-lines';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import {
  createPurchaseOrderSchema,
  type CreatePurchaseOrderInput,
} from '@/schemas/billing.schema';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { PurchaseOrderStatus } from '@/types/enums';

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  currencyCode: string;
  grandTotal: string;
  vendor: { id: string; name: string } | null;
  shipment: { id: string; shipmentNo: string } | null;
}

export interface PurchaseOrderPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canApprove: boolean;
}

const DEFAULTS = {
  vendorId: '',
  shipmentId: '',
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: '',
  currencyCode: 'USD',
  exchangeRate: 1,
  terms: '',
  remarks: '',
  items: [
    { description: '', serviceCode: '', quantity: 1, unitRate: 0, discountRate: 0, taxRate: 0 },
  ],
};

function PurchaseOrderDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { options: vendors } = useOptions('vendors', open);
  const { options: shipments } = useOptions('shipments', open);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: DEFAULTS as unknown as CreatePurchaseOrderInput,
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' }) ?? 'USD';

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(DEFAULTS as unknown as CreatePurchaseOrderInput);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = await apiClient.post<{ poNumber: string }>('/purchase-orders', values);
      toast.success('Purchase order created', saved.poNumber);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreatePurchaseOrderInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The order could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New purchase order"
      description="Commits spend with a vendor. It must be approved before it can be invoiced."
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="purchase-order-form" loading={isSubmitting}>
            Create order
          </Button>
        </>
      }
    >
      <form id="purchase-order-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Vendor" htmlFor="vendorId" error={errors.vendorId?.message} required>
            <Select id="vendorId" invalid={Boolean(errors.vendorId)} {...register('vendorId')}>
              <option value="">Select a vendor</option>
              {vendors.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shipment" htmlFor="shipmentId" error={errors.shipmentId?.message}>
            <Select id="shipmentId" {...register('shipmentId')}>
              <option value="">Not linked</option>
              {shipments.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Order date" htmlFor="orderDate" error={errors.orderDate?.message} required>
            <Input id="orderDate" type="date" {...register('orderDate')} />
          </Field>

          <Field label="Required by" htmlFor="expectedDate" error={errors.expectedDate?.message}>
            <Input id="expectedDate" type="date" {...register('expectedDate')} />
          </Field>

          <Field label="Currency" htmlFor="currencyCode" error={errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...register('currencyCode')} />
          </Field>

          <Field label="Rate to base" htmlFor="exchangeRate" error={errors.exchangeRate?.message}>
            <Input id="exchangeRate" type="number" step="0.00000001" min={0} {...register('exchangeRate')} />
          </Field>
        </div>

        <DocumentLineEditor
          control={control as never}
          register={register as never}
          errors={errors as never}
          currencyCode={currencyCode}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Terms" htmlFor="terms" error={errors.terms?.message}>
            <Textarea id="terms" rows={2} {...register('terms')} />
          </Field>
          <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
            <Textarea id="remarks" rows={2} {...register('remarks')} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function PurchaseOrderModule({ permissions }: { permissions: PurchaseOrderPermissions }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const { options: vendors } = useOptions('vendors');
  const filters = useMemo(
    () => ({ status: status || undefined, vendorId: vendorId || undefined }),
    [status, vendorId],
  );

  const resource = usePagedResource<PurchaseOrderRow>('/purchase-orders', { filters });

  const runAction = async (row: PurchaseOrderRow, action: string, label: string) => {
    try {
      await apiClient.post(`/purchase-orders/${row.id}/${action}`, action === 'cancel' ? { reason: 'Cancelled from the order list' } : undefined);
      toast.success(label, row.poNumber);
      resource.refresh();
    } catch (error) {
      toast.error(`Could not ${label.toLowerCase()}`, error instanceof ApiError ? error.message : undefined);
    }
  };

  const columns: Array<DataTableColumn<PurchaseOrderRow>> = [
    { key: 'poNumber', header: 'Order', sortable: true, width: '150px', cell: (row) => row.poNumber },
    {
      key: 'vendor',
      header: 'Vendor',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{row.vendor?.name ?? '--'}</p>
          {row.shipment ? (
            <p className="truncate text-xs text-ink-muted">{row.shipment.shipmentNo}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'orderDate',
      header: 'Ordered',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.orderDate),
    },
    {
      key: 'expectedDate',
      header: 'Required',
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.expectedDate),
    },
    {
      key: 'grandTotal',
      header: 'Value',
      align: 'right',
      width: '140px',
      cell: (row) => `${row.currencyCode} ${formatAmount(row.grandTotal)}`,
    },
    { key: 'status', header: 'Status', width: '140px', cell: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '120px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {permissions.canUpdate && row.status === PurchaseOrderStatus.DRAFT ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Submit ${row.poNumber}`}
              onClick={() => runAction(row, 'submit', 'Submitted for approval')}
            >
              <Send className="size-4" aria-hidden />
            </Button>
          ) : null}

          {permissions.canApprove &&
          (row.status === PurchaseOrderStatus.PENDING_APPROVAL ||
            row.status === PurchaseOrderStatus.DRAFT) ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Approve ${row.poNumber}`}
              onClick={() => runAction(row, 'approve', 'Approved')}
            >
              <CheckCircle2 className="size-4 text-positive" aria-hidden />
            </Button>
          ) : null}

          {permissions.canUpdate &&
          row.status !== PurchaseOrderStatus.COMPLETED &&
          row.status !== PurchaseOrderStatus.CANCELLED ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Cancel ${row.poNumber}`}
              onClick={() => runAction(row, 'cancel', 'Cancelled')}
            >
              <Ban className="size-4 text-critical" aria-hidden />
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
        searchPlaceholder="Search by order number, vendor or shipment"
        emptyTitle="No purchase orders"
        filters={
          <>
            <Select
              aria-label="Filter by vendor"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              className="w-48"
            >
              <option value="">All vendors</option>
              {vendors.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-44"
            >
              <option value="">All statuses</option>
              {Object.values(PurchaseOrderStatus).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </>
        }
        actions={
          permissions.canCreate ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New order
            </Button>
          ) : null
        }
      />

      <PurchaseOrderDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={resource.refresh}
      />
    </>
  );
}
