'use client';

import { useEffect, useState } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingPanel } from '@/components/ui/spinner';
import { ApiError, apiClient } from '@/lib/api/client';
import { cn } from '@/utils/cn';
import { formatAmount, formatDate } from '@/utils/format';

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
}

interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'text' | 'money' | 'number' | 'date';
}

interface ReportResult {
  key: string;
  title: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string>;
}

function renderCell(value: string | number | null, format?: ReportColumn['format']): string {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  if (format === 'money') {
    return formatAmount(value);
  }

  if (format === 'date') {
    return formatDate(String(value));
  }

  return String(value);
}

export function ReportWorkspace({
  reports,
  canExport,
}: {
  reports: readonly ReportDefinition[];
  canExport: boolean;
}) {
  const [activeKey, setActiveKey] = useState(reports[0]?.key ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeKey) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<ReportResult>(`/reports/${activeKey}`, { from: from || undefined, to: to || undefined })
      .then((data) => {
        if (active) {
          setResult(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : 'The report could not be produced.');
          setResult(null);
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
  }, [activeKey, from, to]);

  const exportUrl = () => {
    const params = new URLSearchParams({ format: 'csv' });

    if (from) {
      params.set('from', from);
    }
    if (to) {
      params.set('to', to);
    }

    return `/api/reports/${activeKey}?${params.toString()}`;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav className="space-y-1.5" aria-label="Reports">
        {reports.map((report) => (
          <button
            key={report.key}
            type="button"
            onClick={() => setActiveKey(report.key)}
            className={cn(
              'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
              activeKey === report.key
                ? 'border-brand bg-brand-soft'
                : 'border-border-subtle bg-surface hover:bg-surface-muted',
            )}
          >
            <span className="flex items-center gap-2">
              <FileBarChart
                className={cn(
                  'size-4 shrink-0',
                  activeKey === report.key ? 'text-brand-strong' : 'text-ink-subtle',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-sm font-medium',
                  activeKey === report.key ? 'text-brand-strong' : 'text-ink',
                )}
              >
                {report.title}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">{report.description}</span>
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader
          title={result?.title ?? 'Report'}
          description={
            result ? `Generated ${formatDate(result.generatedAt)}` : 'Choose a report and period.'
          }
          actions={
            canExport && result ? (
              <a href={exportUrl()} download>
                <Button size="sm" variant="secondary">
                  <Download className="size-4" aria-hidden />
                  Export CSV
                </Button>
              </a>
            ) : null
          }
        />

        <div className="grid gap-3 border-b border-border-subtle px-4 py-3 sm:grid-cols-3">
          <Field label="From" htmlFor="reportFrom">
            <Input id="reportFrom" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="To" htmlFor="reportTo">
            <Input id="reportTo" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>

        {error ? (
          <div className="p-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : loading ? (
          <LoadingPanel label="Producing report" />
        ) : !result || result.rows.length === 0 ? (
          <EmptyState
            title="Nothing to report"
            description="There is no data in the selected period."
          />
        ) : (
          <div className="data-grid-scroll">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-muted text-xs tracking-wide text-ink-subtle uppercase">
                  {result.columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        'px-3 py-2 whitespace-nowrap',
                        column.align === 'right' ? 'text-right' : 'text-left',
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr key={index} className="border-b border-border-subtle last:border-b-0">
                    {result.columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-3 py-2 text-sm',
                          column.align === 'right' ? 'numeric text-right' : 'text-left',
                        )}
                      >
                        {renderCell(row[column.key] ?? null, column.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {result.totals ? (
                <tfoot>
                  <tr className="border-t-2 border-border-strong bg-surface-muted font-semibold">
                    {result.columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-3 py-2 text-sm',
                          column.align === 'right' ? 'numeric text-right' : 'text-left',
                        )}
                      >
                        {index === 0
                          ? 'Total'
                          : result.totals?.[column.key]
                            ? formatAmount(result.totals[column.key] as string)
                            : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
