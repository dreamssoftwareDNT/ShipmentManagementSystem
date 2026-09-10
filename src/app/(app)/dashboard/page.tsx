import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/layout/metric-card';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { EmptyState } from '@/components/ui/empty-state';
import { FinancialTrendChart, ExpenseSplitChart, ShipmentStatusChart } from '@/features/dashboard/charts';
import { dashboardService } from '@/services/dashboard.service';
import { guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';
import { formatAmount, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const CURRENCY_METRICS = new Set(['receivable', 'payable', 'revenue', 'expenses', 'profit']);

export default async function DashboardPage() {
  const user = await guardPage(AppModule.DASHBOARD, PermissionAction.READ);
  const snapshot = await dashboardService.snapshot();

  const firstName = user.fullName.split(' ')[0] ?? user.fullName;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Operational load, receivables and margin across the business."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={CURRENCY_METRICS.has(metric.key) ? formatAmount(metric.value) : metric.value}
            prefix={CURRENCY_METRICS.has(metric.key) ? '$' : undefined}
            changeLabel={metric.changeLabel}
            intent={metric.intent === 'neutral' ? 'neutral' : metric.intent}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue against cost"
            description="Posted invoices and recorded expenses over the last six months, in base currency."
          />
          <CardBody>
            <FinancialTrendChart data={snapshot.monthlyFinancials} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Shipments by stage" description="Where the current book of work sits." />
          <CardBody>
            <ShipmentStatusChart data={snapshot.shipmentsByStatus} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Arriving soon"
            description="Open shipments with an estimated arrival ahead."
            actions={
              <Link href="/shipments" className="text-xs font-medium text-brand hover:underline">
                All shipments
              </Link>
            }
          />
          {snapshot.upcomingArrivals.length === 0 ? (
            <EmptyState
              title="No arrivals scheduled"
              description="Shipments with a future estimated arrival will appear here."
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {snapshot.upcomingArrivals.map((shipment) => (
                <li key={shipment.id}>
                  <Link
                    href={`/shipments/${shipment.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{shipment.shipmentNo}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {shipment.customerName} to {shipment.destinationPort}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="numeric text-xs text-ink-muted">
                        {formatDate(shipment.expectedArrival)}
                      </span>
                      <StatusPill status={shipment.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Expense split" description="Operating cost by category." />
          <CardBody>
            <ExpenseSplitChart data={snapshot.expenseBreakdown} />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Overdue receivables"
          description="Customer invoices past their due date."
          actions={
            <Link href="/freight-invoices" className="text-xs font-medium text-brand hover:underline">
              All invoices
            </Link>
          }
        />
        {snapshot.overdueReceivables.length === 0 ? (
          <EmptyState title="Nothing overdue" description="Every issued invoice is within terms." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {snapshot.overdueReceivables.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/freight-invoices/${invoice.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{invoice.invoiceNo}</p>
                    <p className="truncate text-xs text-ink-muted">{invoice.customerName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-critical">Due {formatDate(invoice.dueDate)}</span>
                    <span className="numeric text-sm font-medium text-ink">
                      {invoice.currencyCode} {formatAmount(invoice.balance)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
