'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { useOptions } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import {
  createCurrencyExchangeSchema,
  type CreateCurrencyExchangeInput,
} from '@/schemas/partner.schema';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { ExchangeSettlementMode } from '@/types/enums';

export interface ExchangeRow {
  id: string;
  referenceNo: string;
  exchangeDate: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: string;
  rate: string;
  toAmount: string;
  commission: string;
  netAmount: string;
  settlementMode: string;
  moneyChanger: { id: string; name: string } | null;
}

const DEFAULTS = {
  moneyChangerId: '',
  shipmentId: '',
  exchangeDate: new Date().toISOString().slice(0, 10),
  fromCurrency: 'USD',
  toCurrency: 'PKR',
  fromAmount: 0,
  rate: 1,
  commission: 0,
  settlementMode: ExchangeSettlementMode.CASH,
  remarks: '',
};

function ExchangeDialog({
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
  const { options: changers } = useOptions('moneyChangers', open);
  const { options: shipments } = useOptions('shipments', open);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCurrencyExchangeInput>({
    resolver: zodResolver(createCurrencyExchangeSchema),
    defaultValues: DEFAULTS as unknown as CreateCurrencyExchangeInput,
  });

  const fromAmount = Number(useWatch({ control, name: 'fromAmount' }) ?? 0);
  const rate = Number(useWatch({ control, name: 'rate' }) ?? 0);
  const commission = Number(useWatch({ control, name: 'commission' }) ?? 0);
  const toCurrency = useWatch({ control, name: 'toCurrency' }) ?? '';

  const converted = fromAmount * rate;
  const net = converted - commission;

  useEffect(() => {
    if (open) {
      setFormError(null);
      reset(DEFAULTS as unknown as CreateCurrencyExchangeInput);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      const saved = await apiClient.post<{ referenceNo: string }>('/currency-exchanges', values);
      toast.success('Exchange recorded', saved.referenceNo);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreateCurrencyExchangeInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The exchange could not be recorded.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a currency exchange"
      description="The converted amount is derived from the quoted rate on the server."
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="exchange-form" loading={isSubmitting}>
            Record exchange
          </Button>
        </>
      }
    >
      <form id="exchange-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Money changer" htmlFor="moneyChangerId" error={errors.moneyChangerId?.message} required>
            <Select
              id="moneyChangerId"
              invalid={Boolean(errors.moneyChangerId)}
              {...register('moneyChangerId')}
            >
              <option value="">Select</option>
              {changers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date" htmlFor="exchangeDate" error={errors.exchangeDate?.message} required>
            <Input id="exchangeDate" type="date" {...register('exchangeDate')} />
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

          <Field label="From currency" htmlFor="fromCurrency" error={errors.fromCurrency?.message} required>
            <Input id="fromCurrency" maxLength={3} className="uppercase" {...register('fromCurrency')} />
          </Field>

          <Field label="Amount sold" htmlFor="fromAmount" error={errors.fromAmount?.message} required>
            <Input id="fromAmount" type="number" step="0.01" min={0} {...register('fromAmount')} />
          </Field>

          <Field label="To currency" htmlFor="toCurrency" error={errors.toCurrency?.message} required>
            <Input
              id="toCurrency"
              maxLength={3}
              className="uppercase"
              invalid={Boolean(errors.toCurrency)}
              {...register('toCurrency')}
            />
          </Field>

          <Field label="Rate" htmlFor="rate" error={errors.rate?.message} required>
            <Input id="rate" type="number" step="0.00000001" min={0} {...register('rate')} />
          </Field>

          <Field label="Commission" htmlFor="commission" error={errors.commission?.message}>
            <Input id="commission" type="number" step="0.01" min={0} {...register('commission')} />
          </Field>

          <Field label="Settlement" htmlFor="settlementMode" error={errors.settlementMode?.message}>
            <Select id="settlementMode" {...register('settlementMode')}>
              {Object.values(ExchangeSettlementMode).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <dl className="rounded-md bg-surface-muted px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Converted amount</dt>
            <dd className="numeric">{formatAmount(converted)}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-border-subtle pt-1 font-semibold">
            <dt>Net received {toCurrency}</dt>
            <dd className="numeric">{formatAmount(net)}</dd>
          </div>
        </dl>

        <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
          <Textarea id="remarks" rows={2} {...register('remarks')} />
        </Field>
      </form>
    </Modal>
  );
}

export function CurrencyExchangePanel({ canCreate }: { canCreate: boolean }) {
  const [changerId, setChangerId] = useState('');
  const [open, setOpen] = useState(false);

  const { options: changers } = useOptions('moneyChangers');
  const filters = useMemo(() => ({ moneyChangerId: changerId || undefined }), [changerId]);
  const resource = usePagedResource<ExchangeRow>('/currency-exchanges', { filters });

  const columns: Array<DataTableColumn<ExchangeRow>> = [
    { key: 'referenceNo', header: 'Reference', width: '150px', cell: (row) => row.referenceNo },
    {
      key: 'moneyChanger',
      header: 'Money changer',
      cell: (row) => row.moneyChanger?.name ?? '--',
    },
    {
      key: 'exchangeDate',
      header: 'Date',
      sortable: true,
      align: 'right',
      width: '110px',
      cell: (row) => formatDate(row.exchangeDate),
    },
    {
      key: 'conversion',
      header: 'Conversion',
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          <span className="numeric">
            {row.fromCurrency} {formatAmount(row.fromAmount)}
          </span>
          <ArrowRight className="size-3 text-ink-subtle" aria-hidden />
          <span className="numeric font-medium">
            {row.toCurrency} {formatAmount(row.toAmount)}
          </span>
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      width: '120px',
      cell: (row) => Number.parseFloat(row.rate).toFixed(4),
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      width: '110px',
      cell: (row) => formatAmount(row.commission),
    },
    {
      key: 'netAmount',
      header: 'Net received',
      align: 'right',
      width: '130px',
      cell: (row) => <span className="font-medium">{formatAmount(row.netAmount)}</span>,
    },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search by reference or currency"
        emptyTitle="No exchanges recorded"
        emptyDescription="Currency conversions carried out through a money changer appear here."
        filters={
          <Select
            aria-label="Filter by money changer"
            value={changerId}
            onChange={(event) => setChangerId(event.target.value)}
            className="w-48"
          >
            <option value="">All money changers</option>
            {changers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        }
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Record exchange
            </Button>
          ) : null
        }
      />

      <ExchangeDialog open={open} onClose={() => setOpen(false)} onSaved={resource.refresh} />
    </>
  );
}
