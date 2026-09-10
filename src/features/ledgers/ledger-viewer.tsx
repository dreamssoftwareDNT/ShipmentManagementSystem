'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingPanel } from '@/components/ui/spinner';
import { MetricCard } from '@/components/layout/metric-card';
import { useOptions, type OptionSet } from '@/hooks/use-options';
import { ApiError, apiClient } from '@/lib/api/client';
import { formatAmount, formatDate, humanise } from '@/utils/format';
import { LedgerPartyType } from '@/types/enums';

interface StatementRow {
  id: string;
  entryDate: string;
  entryType: string;
  referenceType: string;
  referenceNo: string;
  narration: string;
  debit: string;
  credit: string;
  runningBalance: string;
  isReversal: boolean;
}

interface Statement {
  account: { id: string; partyName: string; currencyCode: string; balance: string } | null;
  openingBalance: string;
  closingBalance: string;
  debitTotal: string;
  creditTotal: string;
  rows: StatementRow[];
}

const PARTY_SETS: Record<string, { label: string; optionSet: OptionSet }> = {
  [LedgerPartyType.CUSTOMER]: { label: 'Customer', optionSet: 'customers' },
  [LedgerPartyType.VENDOR]: { label: 'Vendor', optionSet: 'vendors' },
  [LedgerPartyType.CLEARING_AGENT]: { label: 'Clearing agent', optionSet: 'clearingAgents' },
  [LedgerPartyType.MONEY_CHANGER]: { label: 'Money changer', optionSet: 'moneyChangers' },
};

export function LedgerViewer({
  initialPartyType,
  initialPartyId,
}: {
  initialPartyType?: string;
  initialPartyId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [partyType, setPartyType] = useState(initialPartyType ?? LedgerPartyType.CUSTOMER);
  const [partyId, setPartyId] = useState(initialPartyId ?? '');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = PARTY_SETS[partyType] ?? PARTY_SETS[LedgerPartyType.CUSTOMER];
  const { options: parties } = useOptions(config!.optionSet);

  useEffect(() => {
    if (!partyId) {
      setStatement(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<Statement>(`/ledgers/${partyType}/${partyId}`, {
        currencyCode,
        from: from || undefined,
        to: to || undefined,
        pageSize: 200,
      })
      .then((data) => {
        if (active) {
          setStatement(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : 'The statement could not be loaded.');
          setStatement(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [partyType, partyId, currencyCode, from, to]);

  const selectParty = (nextPartyId: string) => {
    setPartyId(nextPartyId);

    const next = new URLSearchParams(searchParams.toString());
    next.set('partyType', partyType);

    if (nextPartyId) {
      next.set('partyId', nextPartyId);
    } else {
      next.delete('partyId');
    }

    router.replace(`/ledgers?${next.toString()}`, { scroll: false });
  };

  const balanceLabel = useMemo(() => {
    if (!statement?.account) {
      return '';
    }

    const balance = Number.parseFloat(statement.closingBalance);

    if (Math.abs(balance) < 0.005) {
      return 'Settled in full';
    }

    if (partyType === LedgerPartyType.CUSTOMER) {
      return balance > 0 ? 'Owed to us by the customer' : 'Credit held for the customer';
    }

    return balance > 0 ? 'Owed by us to this party' : 'Advance paid to this party';
  }, [statement, partyType]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Party type" htmlFor="partyType">
            <Select
              id="partyType"
              value={partyType}
              onChange={(event) => {
                setPartyType(event.target.value);
                setPartyId('');
                setStatement(null);
              }}
            >
              {Object.values(LedgerPartyType).map((value) => (
                <option key={value} value={value}>
                  {humanise(value)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={config!.label} htmlFor="partyId">
            <Select id="partyId" value={partyId} onChange={(event) => selectParty(event.target.value)}>
              <option value="">Select</option>
              {parties.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Currency" htmlFor="currencyCode">
            <Input
              id="currencyCode"
              maxLength={3}
              className="uppercase"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
            />
          </Field>

          <Field label="From" htmlFor="from">
            <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>

          <Field label="To" htmlFor="to">
            <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!partyId ? (
        <Card>
          <EmptyState
            title="Choose a party"
            description="Pick a customer, vendor, clearing agent or money changer to open their statement."
          />
        </Card>
      ) : loading ? (
        <Card>
          <LoadingPanel label="Loading statement" />
        </Card>
      ) : !statement?.account ? (
        <Card>
          <EmptyState
            title="No ledger activity"
            description={`Nothing has been posted for this party in ${currencyCode} yet.`}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Opening balance" value={formatAmount(statement.openingBalance)} prefix={currencyCode} />
            <MetricCard label="Total debit" value={formatAmount(statement.debitTotal)} prefix={currencyCode} />
            <MetricCard label="Total credit" value={formatAmount(statement.creditTotal)} prefix={currencyCode} />
            <MetricCard
              label="Closing balance"
              value={formatAmount(statement.closingBalance)}
              prefix={currencyCode}
              changeLabel={balanceLabel}
              intent={Number.parseFloat(statement.closingBalance) > 0 ? 'warning' : 'positive'}
            />
          </div>

          <Card>
            <CardHeader
              title={`${statement.account.partyName} statement`}
              description="Debit increases what is owed, credit reduces it. Entries are never edited."
            />

            {statement.rows.length === 0 ? (
              <EmptyState title="No entries in this period" />
            ) : (
              <div className="data-grid-scroll">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Reference</th>
                      <th className="px-3 py-2 text-left">Narration</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border-subtle bg-surface-muted/50">
                      <td className="px-3 py-2 text-xs text-ink-subtle" colSpan={5}>
                        Opening balance
                      </td>
                      <td className="numeric px-3 py-2 text-right text-sm font-medium">
                        {formatAmount(statement.openingBalance)}
                      </td>
                    </tr>

                    {statement.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2 text-sm whitespace-nowrap">{formatDate(row.entryDate)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{row.referenceNo}</span>
                            {row.isReversal ? <Badge tone="critical">Reversal</Badge> : null}
                          </div>
                          <p className="text-xs text-ink-subtle">{humanise(row.referenceType)}</p>
                        </td>
                        <td className="px-3 py-2 text-sm text-ink-muted">{row.narration}</td>
                        <td className="numeric px-3 py-2 text-right text-sm">
                          {Number(row.debit) > 0 ? formatAmount(row.debit) : ''}
                        </td>
                        <td className="numeric px-3 py-2 text-right text-sm">
                          {Number(row.credit) > 0 ? formatAmount(row.credit) : ''}
                        </td>
                        <td className="numeric px-3 py-2 text-right text-sm font-medium">
                          {formatAmount(row.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border-strong bg-surface-muted font-semibold">
                      <td className="px-3 py-2 text-sm" colSpan={3}>
                        Period totals
                      </td>
                      <td className="numeric px-3 py-2 text-right text-sm">
                        {formatAmount(statement.debitTotal)}
                      </td>
                      <td className="numeric px-3 py-2 text-right text-sm">
                        {formatAmount(statement.creditTotal)}
                      </td>
                      <td className="numeric px-3 py-2 text-right text-sm">
                        {formatAmount(statement.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
