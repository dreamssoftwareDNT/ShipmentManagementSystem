'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { createVendorSchema, type CreateVendorInput } from '@/schemas/vendor.schema';
import { PartyStatus } from '@/types/enums';

export interface VendorRecord extends CreateVendorInput {
  id: string;
}

const DEFAULTS = {
  code: '',
  vendorTypeId: '',
  name: '',
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  country: '',
  taxNumber: '',
  currencyCode: 'USD',
  paymentTermDays: 30,
  status: PartyStatus.ACTIVE,
  scacCode: '',
  notes: '',
};

export function VendorFormDialog({
  open,
  onClose,
  onSaved,
  vendor,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vendor?: VendorRecord | null;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { options: vendorTypes } = useOptions('vendorTypes', open);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateVendorInput>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: DEFAULTS as unknown as CreateVendorInput,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    reset(
      vendor
        ? ({ ...DEFAULTS, ...vendor } as unknown as CreateVendorInput)
        : (DEFAULTS as unknown as CreateVendorInput),
    );
  }, [open, vendor, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      if (vendor) {
        await apiClient.put(`/vendors/${vendor.id}`, values);
        toast.success('Vendor updated', values.name);
      } else {
        await apiClient.post('/vendors', values);
        toast.success('Vendor created', values.name);
      }

      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateVendorInput, { message: messages[0] });
        }
        return;
      }

      setFormError(error instanceof ApiError ? error.message : 'The vendor could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vendor ? 'Edit vendor' : 'New vendor'}
      description="Carriers, hauliers, warehouses and other service providers you buy from."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="vendor-form" loading={isSubmitting}>
            {vendor ? 'Save changes' : 'Create vendor'}
          </Button>
        </>
      }
    >
      <form id="vendor-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code" htmlFor="code" error={errors.code?.message} hint="Leave blank to auto number">
            <Input id="code" {...register('code')} />
          </Field>

          <Field label="Vendor type" htmlFor="vendorTypeId" error={errors.vendorTypeId?.message} required>
            <Select id="vendorTypeId" invalid={Boolean(errors.vendorTypeId)} {...register('vendorTypeId')}>
              <option value="">Select a type</option>
              {vendorTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Vendor name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" invalid={Boolean(errors.name)} {...register('name')} />
          </Field>

          <Field label="Registered company" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" {...register('companyName')} />
          </Field>

          <Field label="Contact person" htmlFor="contactPerson" error={errors.contactPerson?.message}>
            <Input id="contactPerson" {...register('contactPerson')} />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>

          <Field label="SCAC code" htmlFor="scacCode" error={errors.scacCode?.message} hint="Ocean carriers">
            <Input id="scacCode" maxLength={20} className="uppercase" {...register('scacCode')} />
          </Field>

          <Field label="Tax number" htmlFor="taxNumber" error={errors.taxNumber?.message}>
            <Input id="taxNumber" {...register('taxNumber')} />
          </Field>

          <Field label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1?.message}>
            <Input id="addressLine1" {...register('addressLine1')} />
          </Field>

          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>

          <Field label="Country" htmlFor="country" error={errors.country?.message}>
            <Input id="country" {...register('country')} />
          </Field>

          <Field label="Settlement currency" htmlFor="currencyCode" error={errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...register('currencyCode')} />
          </Field>

          <Field
            label="Payment terms"
            htmlFor="paymentTermDays"
            error={errors.paymentTermDays?.message}
            hint="Days from invoice date"
          >
            <Input id="paymentTermDays" type="number" min={0} max={365} {...register('paymentTermDays')} />
          </Field>

          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Select id="status" {...register('status')}>
              {Object.values(PartyStatus).map((value) => (
                <option key={value} value={value}>
                  {value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <Textarea id="notes" rows={2} {...register('notes')} />
        </Field>
      </form>
    </Modal>
  );
}
