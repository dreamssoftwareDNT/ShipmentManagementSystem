'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useOptions, type OptionSet } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { createPaymentSchema, type CreatePaymentInput } from '@/schemas/billing.schema';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { PaymentMethod } from '@/types/enums';

export interface OutstandingInvoice {
  id: string;
  invoiceNo: string;
  dueDate: string;
  currencyCode: string;
  grandTotal: string;
  balanceAmount: string;
  status: string;
}

export interface PaymentModuleConfig {
  endpoint: string;
  partyLabel: string;
  partyOptionSet: OptionSet;
  outstandingPath: (partyId: string) => string;
  title: string;
  description: string;
  successLabel: string;
  showCheque?: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS = {
  partyId: '',
  paymentDate: todayIso(),
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  currencyCode: 'USD',
  exchangeRate: 1,
  amount: 0,
  bankAccount: '',
  referenceNo: '',
  chequeNo: '',
  chequeDate: '',
  remarks: '',
  allocations: [],
};

/**
 * Allocation is the point of this screen: the amount received or paid is split
 * across open invoices, and the server refuses anything that would over settle
 * an invoice or exceed the payment itself.
 */
export function PaymentFormDialog({
  open,
  onClose,
  onSaved,
  config,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  config: PaymentModuleConfig;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const { options: parties } = useOptions(config.partyOptionSet, open);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: DEFAULTS as unknown as CreatePaymentInput,
  });

  const partyId = useWatch({ control, name: 'partyId' });
  const amount = Number(useWatch({ control, name: 'amount' }) ?? 0);
  const currencyCode = useWatch({ control, name: 'currencyCode' }) ?? 'USD';
  const paymentMethod = useWatch({ control, name: 'paymentMethod' });

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError(null);
    setAllocations({});
    setOutstanding([]);
    reset(DEFAULTS as unknown as CreatePaymentInput);
  }, [open, reset]);

  useEffect(() => {
    if (!open || !partyId) {
      setOutstanding([]);
      return;
    }

    let active = true;
    setLoadingInvoices(true);

    apiClient
      .get<OutstandingInvoice[]>(config.outstandingPath(partyId))
      .then((data) => {
        if (active) {
          setOutstanding(data);
          setAllocations({});
        }
      })
      .catch(() => {
        if (active) {
          setOutstanding([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingInvoices(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, partyId, config]);

  const allocatedTotal = useMemo(
    () =>
      Object.values(allocations).reduce(
        (total, value) => total + (Number.parseFloat(value) || 0),
        0,
      ),
    [allocations],
  );

  const unallocated = amount - allocatedTotal;

  const autoAllocate = () => {
    let remaining = amount;
    const next: Record<string, string> = {};

    for (const invoice of outstanding) {
      if (remaining <= 0) {
        break;
      }

      if (invoice.currencyCode !== currencyCode) {
        continue;
      }

      const balance = Number.parseFloat(invoice.balanceAmount);
      const applied = Math.min(balance, remaining);

      if (applied > 0) {
        next[invoice.id] = applied.toFixed(2);
        remaining -= applied;
      }
    }

    setAllocations(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload: CreatePaymentInput = {
      ...values,
      allocations: Object.entries(allocations)
        .map(([invoiceId, value]) => ({ invoiceId, amount: Number.parseFloat(value) || 0 }))
        .filter((entry) => entry.amount > 0),
    };

    try {
      await apiClient.post(config.endpoint, payload);
      toast.success(config.successLabel, `${currencyCode} ${formatAmount(values.amount)}`);
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          setError(field as keyof CreatePaymentInput, { message: messages[0] });
        }
      }

      setFormError(error instanceof ApiError ? error.message : 'The payment could not be recorded.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={config.title}
      description={config.description}
      width="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={isSubmitting}>
            Record payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={onSubmit} className="space-y-5" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={config.partyLabel} htmlFor="partyId" error={errors.partyId?.message} required>
            <Select id="partyId" invalid={Boolean(errors.partyId)} {...register('partyId')}>
              <option value="">Select</option>
              {parties.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Payment date" htmlFor="paymentDate" error={errors.paymentDate?.message} required>
            <Input id="paymentDate" type="date" {...register('paymentDate')} />
          </Field>

          <Field label="Method" htmlFor="paymentMethod" error={errors.paymentMethod?.message} required>
            <Select id="paymentMethod" {...register('paymentMethod')}>
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Amount" htmlFor="amount" error={errors.amount?.message} required>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min={0}
              invalid={Boolean(errors.amount)}
              {...register('amount')}
            />
          </Field>

          <Field label="Currency" htmlFor="currencyCode" error={errors.currencyCode?.message}>
            <Input id="currencyCode" maxLength={3} className="uppercase" {...register('currencyCode')} />
          </Field>

          <Field label="Rate to base" htmlFor="exchangeRate" error={errors.exchangeRate?.message}>
            <Input id="exchangeRate" type="number" step="0.00000001" min={0} {...register('exchangeRate')} />
          </Field>

          <Field label="Bank account" htmlFor="bankAccount" error={errors.bankAccount?.message}>
            <Input id="bankAccount" {...register('bankAccount')} />
          </Field>

          <Field label="Reference" htmlFor="referenceNo" error={errors.referenceNo?.message}>
            <Input id="referenceNo" placeholder="Transfer reference" {...register('referenceNo')} />
          </Field>

          {config.showCheque !== false && paymentMethod === PaymentMethod.CHEQUE ? (
            <>
              <Field label="Cheque number" htmlFor="chequeNo" error={errors.chequeNo?.message}>
                <Input id="chequeNo" {...register('chequeNo')} />
              </Field>
              <Field label="Cheque date" htmlFor="chequeDate" error={errors.chequeDate?.message}>
                <Input id="chequeDate" type="date" {...register('chequeDate')} />
              </Field>
            </>
          ) : null}
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
              Allocate to open invoices
            </h3>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={autoAllocate}
              disabled={outstanding.length === 0 || amount <= 0}
            >
              Allocate oldest first
            </Button>
          </div>

          {!partyId ? (
            <p className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-sm text-ink-muted">
              Choose a {config.partyLabel.toLowerCase()} to see their open invoices.
            </p>
          ) : loadingInvoices ? (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">Loading open invoices</p>
          ) : outstanding.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong px-3 py-6 text-center text-sm text-ink-muted">
              Nothing outstanding. The payment will be recorded on account.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border-subtle">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-left">Due</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="w-36 px-3 py-2 text-right">Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((invoice) => {
                    const mismatch = invoice.currencyCode !== currencyCode;

                    return (
                      <tr key={invoice.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-1.5 text-sm font-medium">{invoice.invoiceNo}</td>
                        <td className="px-3 py-1.5 text-xs text-ink-muted">
                          {formatDate(invoice.dueDate)}
                        </td>
                        <td className="numeric px-3 py-1.5 text-right text-sm">
                          {invoice.currencyCode} {formatAmount(invoice.grandTotal)}
                        </td>
                        <td className="numeric px-3 py-1.5 text-right text-sm font-medium">
                          {formatAmount(invoice.balanceAmount)}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            max={Number.parseFloat(invoice.balanceAmount)}
                            className="h-8 text-right"
                            disabled={mismatch}
                            title={mismatch ? `This invoice is in ${invoice.currencyCode}` : undefined}
                            aria-label={`Allocate to ${invoice.invoiceNo}`}
                            value={allocations[invoice.id] ?? ''}
                            onChange={(event) =>
                              setAllocations((current) => ({
                                ...current,
                                [invoice.id]: event.target.value,
                              }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-5 text-sm">
            <span className="text-ink-muted">
              Allocated <span className="numeric ml-1 font-medium text-ink">{formatAmount(allocatedTotal)}</span>
            </span>
            <span className={unallocated < 0 ? 'text-critical' : 'text-ink-muted'}>
              {unallocated < 0 ? 'Over allocated by' : 'On account'}
              <span className="numeric ml-1 font-medium">{formatAmount(Math.abs(unallocated))}</span>
            </span>
          </div>
        </section>

        <Field label="Remarks" htmlFor="remarks" error={errors.remarks?.message}>
          <Textarea id="remarks" rows={2} {...register('remarks')} />
        </Field>
      </form>
    </Modal>
  );
}
