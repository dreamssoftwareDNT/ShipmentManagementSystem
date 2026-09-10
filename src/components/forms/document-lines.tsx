'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatAmount } from '@/utils/format';

export interface LineTotals {
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface DocumentLine {
  description: string;
  serviceCode?: string | null;
  quantity: number;
  unitRate: number;
  discountRate: number;
  taxRate: number;
}

interface FormShape {
  items: DocumentLine[];
}

/**
 * Client side totals are a preview only. The server recomputes every figure
 * from the same rules before anything is stored.
 */
export function calculateLineTotals(lines: DocumentLine[], extraCharges = 0): LineTotals {
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const gross = (Number(line.quantity) || 0) * (Number(line.unitRate) || 0);
    const discount = gross * ((Number(line.discountRate) || 0) / 100);
    const net = gross - discount;
    const tax = net * ((Number(line.taxRate) || 0) / 100);

    subTotal += net;
    discountTotal += discount;
    taxTotal += tax;
  }

  return {
    subTotal,
    discountTotal,
    taxTotal,
    grandTotal: subTotal + taxTotal + extraCharges,
  };
}

export function DocumentLineEditor({
  control,
  register,
  errors,
  currencyCode,
  extraCharges = 0,
  showDiscount = true,
}: {
  control: Control<FormShape>;
  register: UseFormRegister<FormShape>;
  errors?: FieldErrors<FormShape>;
  currencyCode: string;
  extraCharges?: number;
  showDiscount?: boolean;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' }) ?? [];
  const totals = calculateLineTotals(items as DocumentLine[], extraCharges);

  const columnCount = showDiscount ? 6 : 5;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">Line items</h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            append({
              description: '',
              serviceCode: '',
              quantity: 1,
              unitRate: 0,
              discountRate: 0,
              taxRate: 0,
            })
          }
        >
          <Plus className="size-4" aria-hidden />
          Add line
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border-subtle">
        <table className="w-full min-w-[680px]">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
              <th className="px-2 py-2 text-left">Description</th>
              <th className="w-24 px-2 py-2 text-right">Qty</th>
              <th className="w-32 px-2 py-2 text-right">Rate</th>
              {showDiscount ? <th className="w-24 px-2 py-2 text-right">Disc %</th> : null}
              <th className="w-24 px-2 py-2 text-right">Tax %</th>
              <th className="w-32 px-2 py-2 text-right">Total</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={columnCount + 2} className="px-3 py-6 text-center text-sm text-ink-muted">
                  Add at least one line item.
                </td>
              </tr>
            ) : (
              fields.map((field, index) => {
                const line = (items[index] ?? {}) as DocumentLine;
                const gross = (Number(line.quantity) || 0) * (Number(line.unitRate) || 0);
                const net = gross - gross * ((Number(line.discountRate) || 0) / 100);
                const lineTotal = net + net * ((Number(line.taxRate) || 0) / 100);

                return (
                  <tr key={field.id} className="border-b border-border-subtle last:border-b-0">
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Line ${index + 1} description`}
                        placeholder="Ocean freight, documentation fee"
                        invalid={Boolean(errors?.items?.[index]?.description)}
                        {...register(`items.${index}.description` as const)}
                      />
                      {errors?.items?.[index]?.description ? (
                        <p className="mt-1 text-xs text-critical">
                          {errors.items[index]?.description?.message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="text-right"
                        aria-label={`Line ${index + 1} quantity`}
                        {...register(`items.${index}.quantity` as const)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="text-right"
                        aria-label={`Line ${index + 1} unit rate`}
                        {...register(`items.${index}.unitRate` as const)}
                      />
                    </td>
                    {showDiscount ? (
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          className="text-right"
                          aria-label={`Line ${index + 1} discount percent`}
                          {...register(`items.${index}.discountRate` as const)}
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        className="text-right"
                        aria-label={`Line ${index + 1} tax percent`}
                        {...register(`items.${index}.taxRate` as const)}
                      />
                    </td>
                    <td className="numeric px-2 py-1.5 text-right text-sm font-medium">
                      {formatAmount(lineTotal)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-ink-subtle transition-colors hover:text-critical"
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <dl className="mt-3 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="numeric">{formatAmount(totals.subTotal)}</dd>
        </div>
        {showDiscount && totals.discountTotal > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Discount</dt>
            <dd className="numeric text-critical">-{formatAmount(totals.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-ink-muted">Tax</dt>
          <dd className="numeric">{formatAmount(totals.taxTotal)}</dd>
        </div>
        {extraCharges > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Duty and disbursements</dt>
            <dd className="numeric">{formatAmount(extraCharges)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-border-subtle pt-1 text-base font-semibold">
          <dt>Total {currencyCode}</dt>
          <dd className="numeric">{formatAmount(totals.grandTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}
