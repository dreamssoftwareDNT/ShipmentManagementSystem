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
import { createAgentInvoiceSchema, type CreateAgentInvoiceInput } from '@/schemas/billing.schema';
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
  clearingAgentId: '',
  agentRefNo: '',
  shipmentId: '',
  invoiceDate: todayIso(),
  dueDate: addDays(15),
  currencyCode: 'USD',
  exchangeRate: 1,
  dutyAmount: 0,
  reimbursable: 0,
  remarks: '',
  items: [
    { description: '', serviceCode: '', quantity: 1, unitRate: 0, discountRate: 0, taxRate: 0 },
  ],
};

function AgentInvoiceDialog({
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
  const { options: agents } = useOptions('clearingAgents', open);
  const { options: shipments } = useOptions('shipments', open);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateAgentInvoiceInput>({
    resolver: zodResolver(createAgentInvoiceSchema),
    defaultValues: DEFAULTS as unknown as CreateAgentInvoiceInput,
  });

  const currencyCode = useWatch({ control, name: 'currencyCode' }) ?? 'USD';
  const dutyAmount = Number(useWatch({ control, name: 'dutyAmount' }) ?? 0);
  const reimbursable = Number(useWatch({ control, name: 'reimbursable' }) ?? 0);

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(DEFAULTS as unknown as CreateAgentInvoiceInput);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = await apiClient.post<{ invoiceNo: string }>('/agent-invoices', values);
      toast.success('Agent invoice posted', saved.invoiceNo);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateAgentInvoiceInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The invoice could not be posted.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record clearing agent invoice"
      description="Service fees are taxed. Duty and disbursements are added to the total untaxed."
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="agent-invoice-form" loading={isSubmitting}>
            Post invoice
          </Button>
        </>
      }
    >
      <form id="agent-invoice-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Clearing agent" htmlFor="clearingAgentId" error={errors.clearingAgentId?.message} required>
            <Select
              id="clearingAgentId"
              invalid={Boolean(errors.clearingAgentId)}
              {...register('clearingAgentId')}
            >
              <option value="">Select an agent</option>
              {agents.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Their invoice number" htmlFor="agentRefNo" error={errors.agentRefNo?.message}>
            <Input id="agentRefNo" {...register('agentRefNo')} />
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

          <Field label="Customs duty" htmlFor="dutyAmount" error={errors.dutyAmount?.message}>
            <Input id="dutyAmount" type="number" step="0.01" min={0} {...register('dutyAmount')} />
          </Field>

          <Field
            label="Disbursements"
            htmlFor="reimbursable"
            error={errors.reimbursable?.message}
            hint="Costs the agent advanced on our behalf"
          >
            <Input id="reimbursable" type="number" step="0.01" min={0} {...register('reimbursable')} />
          </Field>
        </div>

        <DocumentLineEditor
          control={control as never}
          register={register as never}
          errors={errors as never}
          currencyCode={currencyCode}
          extraCharges={dutyAmount + reimbursable}
          showDiscount={false}
        />

        <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
          <Textarea id="remarks" rows={2} {...register('remarks')} />
        </Field>
      </form>
    </Modal>
  );
}

export function AgentInvoiceModule({ canCreate }: { canCreate: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <PayableInvoiceList
      canCreate={canCreate}
      onCreate={() => setOpen(true)}
      config={{
        endpoint: '/agent-invoices',
        partyLabel: 'Clearing agent',
        partyOptionSet: 'clearingAgents',
        createLabel: 'Record invoice',
      }}
      dialog={(refresh) => (
        <AgentInvoiceDialog open={open} onClose={() => setOpen(false)} onSaved={refresh} />
      )}
    />
  );
}
