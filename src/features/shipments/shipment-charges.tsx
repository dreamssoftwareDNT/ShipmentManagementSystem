'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiClient } from '@/lib/api/client';
import { formatAmount } from '@/utils/format';
import { ChargeType } from '@/types/enums';

export interface ShipmentChargeRow {
  id: string;
  chargeType: string;
  description: string;
  quantity: string;
  unitRate: string;
  currencyCode: string;
  amount: string;
  baseAmount: string;
}

interface ChargeDraft {
  chargeType: string;
  description: string;
  quantity: string;
  unitRate: string;
  currencyCode: string;
  exchangeRate: string;
}

const EMPTY_DRAFT: ChargeDraft = {
  chargeType: ChargeType.COST,
  description: '',
  quantity: '1',
  unitRate: '',
  currencyCode: 'USD',
  exchangeRate: '1',
};

export function ShipmentCharges({
  shipmentId,
  charges,
  canEdit,
}: {
  shipmentId: string;
  charges: ShipmentChargeRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChargeDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revenue = charges
    .filter((charge) => charge.chargeType === ChargeType.REVENUE)
    .reduce((total, charge) => total + Number.parseFloat(charge.baseAmount), 0);
  const cost = charges
    .filter((charge) => charge.chargeType === ChargeType.COST)
    .reduce((total, charge) => total + Number.parseFloat(charge.baseAmount), 0);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/shipments/${shipmentId}/charges`, {
        chargeType: draft.chargeType,
        description: draft.description,
        quantity: Number(draft.quantity),
        unitRate: Number(draft.unitRate),
        currencyCode: draft.currencyCode,
        exchangeRate: Number(draft.exchangeRate),
      });

      toast.success('Charge added', draft.description);
      setDraft(EMPTY_DRAFT);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The charge could not be added.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Charge sheet"
          description="Quoted revenue and expected cost used for the estimated margin."
          actions={
            canEdit ? (
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Add charge
              </Button>
            ) : null
          }
        />

        {charges.length === 0 ? (
          <EmptyState
            title="No charges quoted"
            description="Add revenue and cost lines to build the estimated margin for this job."
          />
        ) : (
          <>
            <div className="data-grid-scroll">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Kind</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge) => (
                    <tr key={charge.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-3 py-2">{charge.description}</td>
                      <td className="px-3 py-2">
                        <Badge tone={charge.chargeType === ChargeType.REVENUE ? 'positive' : 'warning'}>
                          {charge.chargeType === ChargeType.REVENUE ? 'Revenue' : 'Cost'}
                        </Badge>
                      </td>
                      <td className="numeric px-3 py-2 text-right">{formatAmount(charge.quantity)}</td>
                      <td className="numeric px-3 py-2 text-right">{formatAmount(charge.unitRate)}</td>
                      <td className="numeric px-3 py-2 text-right font-medium">
                        {charge.currencyCode} {formatAmount(charge.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-6 border-t border-border-subtle px-4 py-2.5 text-sm">
              <span className="text-ink-muted">
                Revenue <span className="numeric ml-1 font-medium text-ink">{formatAmount(revenue)}</span>
              </span>
              <span className="text-ink-muted">
                Cost <span className="numeric ml-1 font-medium text-ink">{formatAmount(cost)}</span>
              </span>
              <span className="text-ink-muted">
                Estimated margin
                <span
                  className={`numeric ml-1 font-semibold ${revenue - cost < 0 ? 'text-critical' : 'text-positive'}`}
                >
                  {formatAmount(revenue - cost)}
                </span>
              </span>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a charge"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} disabled={!draft.description || !draft.unitRate}>
              Add charge
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label="Kind" htmlFor="chargeType">
            <Select
              id="chargeType"
              value={draft.chargeType}
              onChange={(event) => setDraft({ ...draft, chargeType: event.target.value })}
            >
              <option value={ChargeType.COST}>Cost we expect to pay</option>
              <option value={ChargeType.REVENUE}>Revenue we expect to bill</option>
            </Select>
          </Field>

          <Field label="Description" htmlFor="description" required>
            <Input
              id="description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Ocean freight, terminal handling"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" htmlFor="quantity">
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min={0}
                value={draft.quantity}
                onChange={(event) => setDraft({ ...draft, quantity: event.target.value })}
              />
            </Field>

            <Field label="Unit rate" htmlFor="unitRate" required>
              <Input
                id="unitRate"
                type="number"
                step="0.01"
                min={0}
                value={draft.unitRate}
                onChange={(event) => setDraft({ ...draft, unitRate: event.target.value })}
              />
            </Field>

            <Field label="Currency" htmlFor="currencyCode">
              <Input
                id="currencyCode"
                maxLength={3}
                className="uppercase"
                value={draft.currencyCode}
                onChange={(event) => setDraft({ ...draft, currencyCode: event.target.value })}
              />
            </Field>

            <Field label="Rate to base" htmlFor="exchangeRate">
              <Input
                id="exchangeRate"
                type="number"
                step="0.00000001"
                min={0}
                value={draft.exchangeRate}
                onChange={(event) => setDraft({ ...draft, exchangeRate: event.target.value })}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
