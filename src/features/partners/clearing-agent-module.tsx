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
import {
  createClearingAgentSchema,
  type CreateClearingAgentInput,
} from '@/schemas/partner.schema';
import { PartyStatus, LedgerPartyType } from '@/types/enums';
import { SimplePartyModule, type SimplePartyRow } from './simple-party-module';

const DEFAULTS = {
  code: '',
  name: '',
  companyName: '',
  licenseNumber: '',
  contactPerson: '',
  email: '',
  phone: '',
  addressLine1: '',
  city: '',
  country: '',
  portOfOperation: '',
  currencyCode: 'USD',
  paymentTermDays: 15,
  status: PartyStatus.ACTIVE,
};

function ClearingAgentDialog({
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
  } = useForm<CreateClearingAgentInput>({
    resolver: zodResolver(createClearingAgentSchema),
    defaultValues: DEFAULTS as unknown as CreateClearingAgentInput,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    reset(
      record
        ? ({ ...DEFAULTS, ...record } as unknown as CreateClearingAgentInput)
        : (DEFAULTS as unknown as CreateClearingAgentInput),
    );
  }, [open, record, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      if (record) {
        await apiClient.put(`/clearing-agents/${record.id}`, values);
        toast.success('Clearing agent updated', values.name);
      } else {
        await apiClient.post('/clearing-agents', values);
        toast.success('Clearing agent created', values.name);
      }

      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateClearingAgentInput, { message: messages[0] });
        }
        return;
      }

      setFormError(error instanceof ApiError ? error.message : 'The agent could not be saved.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit clearing agent' : 'New clearing agent'}
      description="Customs brokers who clear cargo on your behalf at a given port."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="clearing-agent-form" loading={isSubmitting}>
            {record ? 'Save changes' : 'Create agent'}
          </Button>
        </>
      }
    >
      <form id="clearing-agent-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code" htmlFor="code" error={errors.code?.message} hint="Leave blank to auto number">
            <Input id="code" {...register('code')} />
          </Field>

          <Field label="Agent name" htmlFor="name" error={errors.name?.message} required>
            <Input id="name" invalid={Boolean(errors.name)} {...register('name')} />
          </Field>

          <Field label="Registered company" htmlFor="companyName" error={errors.companyName?.message}>
            <Input id="companyName" {...register('companyName')} />
          </Field>

          <Field label="Customs licence" htmlFor="licenseNumber" error={errors.licenseNumber?.message}>
            <Input id="licenseNumber" {...register('licenseNumber')} />
          </Field>

          <Field label="Port of operation" htmlFor="portOfOperation" error={errors.portOfOperation?.message}>
            <Input id="portOfOperation" {...register('portOfOperation')} />
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

          <Field label="Address" htmlFor="addressLine1" error={errors.addressLine1?.message}>
            <Input id="addressLine1" {...register('addressLine1')} />
          </Field>

          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>

          <Field label="Country" htmlFor="country" error={errors.country?.message}>
            <Input id="country" {...register('country')} />
          </Field>

          <Field label="Currency" htmlFor="currencyCode" error={errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...register('currencyCode')} />
          </Field>

          <Field label="Payment terms" htmlFor="paymentTermDays" error={errors.paymentTermDays?.message}>
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
      </form>
    </Modal>
  );
}

export function ClearingAgentModule({
  permissions,
}: {
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}) {
  return (
    <SimplePartyModule
      permissions={permissions}
      config={{
        endpoint: '/clearing-agents',
        entityLabel: 'Clearing agent',
        createLabel: 'New agent',
        ledgerPartyType: LedgerPartyType.CLEARING_AGENT,
        searchPlaceholder: 'Search by name, licence or port',
        extraColumns: [
          {
            key: 'portOfOperation',
            header: 'Port',
            cell: (row) => row.portOfOperation ?? '--',
          },
          {
            key: 'licenseNumber',
            header: 'Licence',
            cell: (row) => <span className="text-ink-muted">{row.licenseNumber ?? '--'}</span>,
          },
        ],
      }}
      renderDialog={(args) => <ClearingAgentDialog {...args} />}
    />
  );
}
