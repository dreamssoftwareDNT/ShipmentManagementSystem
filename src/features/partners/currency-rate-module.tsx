'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { ResourceList } from '@/components/data/resource-list';
import type { DataTableColumn } from '@/components/data/data-table';
import { usePagedResource } from '@/hooks/use-paged-resource';
import { ApiError, apiClient } from '@/lib/api/client';
import { formatDate } from '@/utils/format';

interface CurrencyOption {
  id: string;
  code: string;
  name: string;
}

export interface CurrencyRateRow {
  id: string;
  rate: string;
  effectiveFrom: string;
  source: string | null;
  fromCurrency: { code: string; name: string };
  toCurrency: { code: string; name: string };
}

function RateDialog({
  open,
  currencies,
  onClose,
  onSaved,
}: {
  open: boolean;
  currencies: CurrencyOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [fromCurrencyId, setFromCurrencyId] = useState('');
  const [toCurrencyId, setToCurrencyId] = useState('');
  const [rate, setRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (fromCurrencyId === toCurrencyId) {
      setError('Choose two different currencies.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await apiClient.post('/currency-rates', {
        fromCurrencyId,
        toCurrencyId,
        rate: Number(rate),
        effectiveFrom,
        source: source || undefined,
      });

      toast.success('Rate recorded');
      setRate('');
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'The rate could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an exchange rate"
      description="Rates are effective dated. Documents pick up the rate current on their own date."
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!fromCurrencyId || !toCurrencyId || !rate}>
            Save rate
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label="From currency" htmlFor="fromCurrencyId" required>
          <Select
            id="fromCurrencyId"
            value={fromCurrencyId}
            onChange={(event) => setFromCurrencyId(event.target.value)}
          >
            <option value="">Select</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="To currency" htmlFor="toCurrencyId" required>
          <Select
            id="toCurrencyId"
            value={toCurrencyId}
            onChange={(event) => setToCurrencyId(event.target.value)}
          >
            <option value="">Select</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} - {currency.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Rate" htmlFor="rate" required hint="One unit of the source currency">
          <Input
            id="rate"
            type="number"
            step="0.00000001"
            min={0}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </Field>

        <Field label="Effective from" htmlFor="effectiveFrom" required>
          <Input
            id="effectiveFrom"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </Field>

        <Field label="Source" htmlFor="source" hint="Bank, central bank, contract">
          <Input id="source" value={source} onChange={(event) => setSource(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function CurrencyRateModule({
  currencies,
  canCreate,
}: {
  currencies: CurrencyOption[];
  canCreate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const resource = usePagedResource<CurrencyRateRow>('/currency-rates', {
    initialSortBy: 'effectiveFrom',
  });

  const columns: Array<DataTableColumn<CurrencyRateRow>> = [
    {
      key: 'pair',
      header: 'Pair',
      width: '160px',
      cell: (row) => (
        <span className="font-medium">
          {row.fromCurrency.code} / {row.toCurrency.code}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      width: '160px',
      cell: (row) => <span className="numeric">{Number.parseFloat(row.rate).toFixed(6)}</span>,
    },
    {
      key: 'effectiveFrom',
      header: 'Effective from',
      sortable: true,
      align: 'right',
      width: '140px',
      cell: (row) => formatDate(row.effectiveFrom),
    },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => <span className="text-ink-muted">{row.source ?? '--'}</span>,
    },
  ];

  return (
    <>
      <ResourceList
        resource={resource}
        columns={columns}
        rowKey={(row) => row.id}
        searchPlaceholder="Search rates"
        emptyTitle="No exchange rates recorded"
        emptyDescription="Add a rate so invoices in foreign currency convert to the base currency."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Add rate
            </Button>
          ) : null
        }
      />

      <RateDialog
        open={open}
        currencies={currencies}
        onClose={() => setOpen(false)}
        onSaved={resource.refresh}
      />
    </>
  );
}
