'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { StatusPill } from '@/components/ui/status-pill';
import { useToast } from '@/components/ui/toast';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { createExpenseSchema, type CreateExpenseInput } from '@/schemas/expense.schema';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { ExpenseStatus, PaymentMethod } from '@/types/enums';

export interface ExpenseRow {
  id: string;
  expenseNo: string;
  expenseDate: string;
  description: string;
  currencyCode: string;
  amount: string;
  taxAmount: string;
  totalAmount: string;
  status: string;
  isBillable: boolean;
  paymentMethod: string;
  category: { id: string; name: string } | null;
  shipment: { id: string; shipmentNo: string } | null;
}

export interface ExpensePermissions {
  canCreate: boolean;
  canApprove: boolean;
  canDelete: boolean;
}

const DEFAULTS = {
  categoryId: '',
  shipmentId: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  currencyCode: 'USD',
  exchangeRate: 1,
  amount: 0,
  taxAmount: 0,
  paymentMethod: PaymentMethod.CASH,
  isBillable: false,
  referenceNo: '',
};

function ExpenseDialog({
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
  const { options: categories } = useOptions('expenseCategories', open);
  const { options: shipments } = useOptions('shipments', open);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: DEFAULTS as unknown as CreateExpenseInput,
  });

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(DEFAULTS as unknown as CreateExpenseInput);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = await apiClient.post<{ expenseNo: string }>('/expenses', values);
      toast.success('Expense recorded', saved.expenseNo);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateExpenseInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The expense could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an expense"
      description="Operating cost, optionally charged against a shipment."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={isSubmitting}>
            Record expense
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Category" htmlFor="categoryId" error={errors.categoryId?.message} required>
            <Select id="categoryId" invalid={Boolean(errors.categoryId)} {...register('categoryId')}>
              <option value="">Select a category</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Shipment" htmlFor="shipmentId" error={errors.shipmentId?.message}>
            <Select id="shipmentId" {...register('shipmentId')}>
              <option value="">General overhead</option>
              {shipments.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" htmlFor="expenseDate" error={errors.expenseDate?.message} required>
            <Input id="expenseDate" type="date" {...register('expenseDate')} />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={errors.description?.message}
            required
            className="sm:col-span-2"
          >
            <Input id="description" invalid={Boolean(errors.description)} {...register('description')} />
          </Field>

          <Field label="Reference" htmlFor="referenceNo" error={errors.referenceNo?.message}>
            <Input id="referenceNo" {...register('referenceNo')} />
          </Field>

          <Field label="Amount" htmlFor="amount" error={errors.amount?.message} required>
            <Input id="amount" type="number" step="0.01" min={0} {...register('amount')} />
          </Field>

          <Field label="Tax" htmlFor="taxAmount" error={errors.taxAmount?.message}>
            <Input id="taxAmount" type="number" step="0.01" min={0} {...register('taxAmount')} />
          </Field>

          <Field label="Currency" htmlFor="currencyCode" error={errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...register('currencyCode')} />
          </Field>

          <Field label="Rate to base" htmlFor="exchangeRate" error={errors.exchangeRate?.message}>
            <Input id="exchangeRate" type="number" step="0.00000001" min={0} {...register('exchangeRate')} />
          </Field>

          <Field label="Paid by" htmlFor="paymentMethod" error={errors.paymentMethod?.message}>
            <Select id="paymentMethod" {...register('paymentMethod')}>
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" className="size-4 accent-brand" {...register('isBillable')} />
          Rebill this cost to the customer
        </label>
      </form>
    </Modal>
  );
}

export function ExpenseModule({ permissions }: { permissions: ExpensePermissions }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { options: categories } = useOptions('expenseCategories');
  const filters = useMemo(
    () => ({ status: status || undefined, categoryId: categoryId || undefined }),
    [status, categoryId],
  );

  const resource = usePagedResource<ExpenseRow>('/expenses', { filters });

  const approve = async (row: ExpenseRow) => {
    try {
      await apiClient.post(`/expenses/${row.id}/approve`);
      toast.success('Expense approved', row.expenseNo);
      resource.refresh();
    } catch (error) {
      toast.error('Could not approve', error instanceof ApiError ? error.message : undefined);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }

    setBusy(true);

    try {
      await apiClient.delete(`/expenses/${pendingDelete.id}`);
      toast.success('Expense removed', pendingDelete.expenseNo);
      setPendingDelete(null);
      resource.refresh();
    } catch (error) {
      toast.error('Could not remove', error instanceof ApiError ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const columns: Array<DataTableColumn<ExpenseRow>> = [
    { key: 'expenseNo', header: 'Reference', width: '150px', cell: (row) => row.expenseNo },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{row.description}</p>
          <p className="truncate text-xs text-ink-muted">
            {row.category?.name ?? 'Uncategorised'}
            {row.shipment ? ` · ${row.shipment.shipmentNo}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.expenseDate),
    },
    {
      key: 'paymentMethod',
      header: 'Paid by',
      width: '130px',
      cell: (row) => humanise(row.paymentMethod),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      width: '130px',
      cell: (row) => `${row.currencyCode} ${formatAmount(row.totalAmount)}`,
    },
    { key: 'status', header: 'Status', width: '110px', cell: (row) => <StatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '92px',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {permissions.canApprove && row.status === ExpenseStatus.RECORDED ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Approve ${row.expenseNo}`}
              onClick={() => approve(row)}
            >
              <CheckCircle2 className="size-4 text-positive" aria-hidden />
            </Button>
          ) : null}
          {permissions.canDelete && row.status !== ExpenseStatus.APPROVED ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${row.expenseNo}`}
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
        searchPlaceholder="Search by reference, description or shipment"
        emptyTitle="No expenses recorded"
        filters={
          <>
            <Select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-44"
            >
              <option value="">All categories</option>
              {categories.map((option) => (
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
              {Object.values(ExpenseStatus).map((value) => (
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
              Record expense
            </Button>
          ) : null
        }
      />

      <ExpenseDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={resource.refresh} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={busy}
        destructive
        title="Remove this expense?"
        confirmLabel="Remove"
        message={`${pendingDelete?.expenseNo ?? ''} will be removed and any linked shipment cost recalculated.`}
      />
    </>
  );
}
