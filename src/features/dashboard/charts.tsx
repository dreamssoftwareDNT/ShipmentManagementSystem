'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';
import { formatAmount } from '@/utils/format';

const SERIES_REVENUE = '#2a78d6';
const SERIES_COST = '#eb6834';
const AXIS_INK = '#7b869c';
const GRID_LINE = '#e2e6ec';

const AXIS_STYLE = { fontSize: 11, fill: AXIS_INK } as const;

function compactMoney(value: number): string {
  const magnitude = Math.abs(value);

  if (magnitude >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }

  if (magnitude >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return String(Math.round(value));
}

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valuePrefix?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface px-2.5 py-2 shadow-lg">
      <p className="text-xs font-medium text-ink">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="text-ink-muted">{entry.name}</span>
            <span className="numeric ml-auto font-medium text-ink">
              {valuePrefix}
              {formatAmount(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface FinancialPoint {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
}

export function FinancialTrendChart({ data }: { data: FinancialPoint[] }) {
  const hasValues = data.some((point) => point.revenue !== 0 || point.cost !== 0);

  if (!hasValues) {
    return (
      <EmptyState
        title="No financial activity yet"
        description="Issue an invoice or record an expense and the trend will build here."
      />
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={GRID_LINE} vertical={false} />
          <XAxis
            dataKey="period"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: GRID_LINE }}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={compactMoney}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
            content={<ChartTooltip valuePrefix="$" />}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="square"
            iconSize={9}
            formatter={(value) => <span className="text-xs text-ink-muted">{value}</span>}
          />
          <Bar dataKey="revenue" name="Revenue" fill={SERIES_REVENUE} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="cost" name="Cost" fill={SERIES_COST} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface StatusPoint {
  status: string;
  label: string;
  count: number;
}

/**
 * Stage is carried by the axis label, so a single hue is correct here. Colour
 * would only repeat what the label already says.
 */
export function ShipmentStatusChart({ data }: { data: StatusPoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="No shipments recorded" />;
  }

  const ordered = [...data].sort((left, right) => right.count - left.count);
  const height = Math.max(180, ordered.length * 30);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={ordered}
          layout="vertical"
          margin={{ top: 4, right: 34, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke={GRID_LINE} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={126}
          />
          <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} content={<ChartTooltip />} />
          <Bar dataKey="count" name="Shipments" fill={SERIES_REVENUE} radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList
              dataKey="count"
              position="right"
              className="numeric"
              style={{ fontSize: 11, fill: AXIS_INK }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ExpensePoint {
  category: string;
  amount: number;
}

export function ExpenseSplitChart({ data }: { data: ExpensePoint[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No expenses recorded"
        description="Approved and recorded expenses appear here by category."
      />
    );
  }

  const top = data.slice(0, 6);
  const remainder = data.slice(6);
  const rows =
    remainder.length > 0
      ? [
          ...top,
          {
            category: 'Other',
            amount: remainder.reduce((total, entry) => total + entry.amount, 0),
          },
        ]
      : top;

  const height = Math.max(180, rows.length * 30);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID_LINE} horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="category"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip
            cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
            content={<ChartTooltip valuePrefix="$" />}
          />
          <Bar dataKey="amount" name="Spend" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {rows.map((row) => (
              <Cell
                key={row.category}
                fill={row.category === 'Other' ? '#86b6ef' : SERIES_REVENUE}
              />
            ))}
            <LabelList
              dataKey="amount"
              position="right"
              className="numeric"
              style={{ fontSize: 11, fill: AXIS_INK }}
              formatter={(value: number) => `$${compactMoney(value)}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
