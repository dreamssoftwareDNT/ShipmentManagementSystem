'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { DocumentLineEditor } from '@/components/forms/document-lines';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import {
  createVendorInvoiceSchema,
  type CreateVendorInvoiceInput,
} from '@/schemas/billing.schema';
import { PayableInvoiceList } from './payable-invoice-list';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const DEFAULTS = {
  vendorId: '',
  vendorRefNo: '',
  shipmentId: '',
  purchaseOrderId: '',
  invoiceDate: todayIso(),
  dueDate: addDays(30),
  currencyCode: 'USD',
  exchangeRate: 1,
  remarks: '',
  items: [
    { description: '', serviceCode: '', quantity: 1, unitRate: 0, discountRate: 0, taxRate: 0 },
  ],
};

function VendorInvoiceDialog({
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
  } = useForm<CreateVendorInvoiceInput>({
    resolver: zodResolver(createVendorInvoiceSchema),
    defaultValues: DEFAULTS as unknown as CreateVendorInvoiceInput,
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' }) ?? 'USD';

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(DEFAULTS as unknown as CreateVendorInvoiceInput);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = await apiClient.post<{ invoiceNo: string }>('/vendor-invoices', values);
      toast.success('Vendor invoice posted', saved.invoiceNo);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateVendorInvoiceInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The invoice could not be posted.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record vendor invoice"
      description="Posting debits the vendor statement immediately."
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="vendor-invoice-form" loading={isSubmitting}>
            Post invoice
          </Button>
        </>
      }
    >
      <form id="vendor-invoice-form" onSubmit={onSubmit} className="space-y-5" noValidate>
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

          <Field label="Their invoice number" htmlFor="vendorRefNo" error={errors.vendorRefNo?.message}>
            <Input id="vendorRefNo" {...register('vendorRefNo')} />
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

          <Field label="Invoice date" htmlFor="invoiceDate" error={errors.invoiceDate?.message} required>
            <Input id="invoiceDate" type="date" {...register('invoiceDate')} />
          </Field>

          <Field label="Due date" htmlFor="dueDate" error={errors.dueDate?.message} required>
            <Input id="dueDate" type="date" invalid={Boolean(errors.dueDate)} {...register('dueDate')} />
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

        <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
          <Textarea id="remarks" rows={2} {...register('remarks')} />
        </Field>
      </form>
    </Modal>
  );
}

export function VendorInvoiceModule({ canCreate }: { canCreate: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <PayableInvoiceList
      canCreate={canCreate}
      onCreate={() => setOpen(true)}
      config={{
        endpoint: '/vendor-invoices',
        partyLabel: 'Vendor',
        partyOptionSet: 'vendors',
        createLabel: 'Record invoice',
      }}
      dialog={(refresh) => (
        <VendorInvoiceDialog open={open} onClose={() => setOpen(false)} onSaved={refresh} />
      )}
    />
  );
}
