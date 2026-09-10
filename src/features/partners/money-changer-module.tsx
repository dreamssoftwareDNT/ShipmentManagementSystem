'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiClient } from '@/lib/api/client';
import { createMoneyChangerSchema, type CreateMoneyChangerInput } from '@/schemas/partner.schema';
import { LedgerPartyType, PartyStatus } from '@/types/enums';
import { SimplePartyModule, type SimplePartyRow } from './simple-party-module';

const DEFAULTS = {
  code: '',
  name: '',
  companyName: '',
  licenseNumber: '',
  contactPerson: '',
  phone: '',
  email: '',
  city: '',
  country: '',
  status: PartyStatus.ACTIVE,
};

function MoneyChangerDialog({
  open,
  record,
  onClose,
  onSaved,
}: {
  open: boolean;
  record: SimplePartyRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateMoneyChangerInput>({
    resolver: zodResolver(createMoneyChangerSchema),
    defaultValues: DEFAULTS as unknown as CreateMoneyChangerInput,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    reset(
      record
        ? ({ ...DEFAULTS, ...record } as unknown as CreateMoneyChangerInput)
        : (DEFAULTS as unknown as CreateMoneyChangerInput),
    );
  }, [open, record, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      if (record) {
        await apiClient.put(`/money-changers/${record.id}`, values);
        toast.success('Money changer updated', values.name);
      } else {
        await apiClient.post('/money-changers', values);
        toast.success('Money changer created', values.name);
      }

      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateMoneyChangerInput, { message: messages[0] });
        }
        return;
      }

      setFormError(error instanceof ApiError ? error.message : 'The record could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit money changer' : 'New money changer'}
      description="Counterparties used to convert currency for overseas settlements."
      width="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="money-changer-form" loading={isSubmitting}>
            {record ? 'Save changes' : 'Create record'}
          </Button>
        </>
      }
    >
      <form id="money-changer-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code" htmlFor="code" error={errors.code?.message} hint="Leave blank to auto number">
            <Input id="code" {...register('code')} />
          </Field>

          <Field label="Name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" invalid={Boolean(errors.name)} {...register('name')} />
          </Field>

          <Field label="Registered company" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" {...register('companyName')} />
          </Field>

          <Field label="Licence number" htmlFor="licenseNumber" error={errors.licenseNumber?.message}>
            <Input id="licenseNumber" {...register('licenseNumber')} />
          </Field>

          <Field label="Contact person" htmlFor="contactPerson" error={errors.contactPerson?.message}>
            <Input id="contactPerson" {...register('contactPerson')} />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" {...register('phone')} />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </Field>

          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>

          <Field label="Country" htmlFor="country" error={errors.country?.message}>
            <Input id="country" {...register('country')} />
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
      </form>
    </Modal>
  );
}

export function MoneyChangerModule({
  permissions,
}: {
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  return (
    <SimplePartyModule
      permissions={permissions}
      config={{
        endpoint: '/money-changers',
        entityLabel: 'Money changer',
        createLabel: 'New money changer',
        ledgerPartyType: LedgerPartyType.MONEY_CHANGER,
        searchPlaceholder: 'Search by name, company or licence',
        extraColumns: [
          {
            key: 'licenseNumber',
            header: 'Licence',
            cell: (row) => <span className="text-ink-muted">{row.licenseNumber ?? '--'}</span>,
          },
        ],
      }}
      renderDialog={(args) => <MoneyChangerDialog {...args} />}
    />
  );
}
