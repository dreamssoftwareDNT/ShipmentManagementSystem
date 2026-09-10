import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { toDecimal } from '@/lib/money';
import { COST_GROUP_LABELS, CostGroup, ShipmentStatus } from '@/types/enums';

export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
  changeLabel?: string;
  intent: 'neutral' | 'positive' | 'negative' | 'warning';
  isMoney?: boolean;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
}

export interface MonthlyCostPoint {
  period: string;
  goodsValue: number;
  additionalCost: number;
  total: number;
}

export interface CostGroupBreakdown {
  group: string;
  label: string;
  amount: number;
}

export interface DashboardSnapshot {
  metrics: DashboardMetric[];
  shipmentsByStatus: StatusBreakdown[];
  monthlyCosts: MonthlyCostPoint[];
  costBreakdown: CostGroupBreakdown[];
  arrivingSoon: Array<{
    id: string;
    shipmentNo: string;
    supplierName: string;
    destinationPort: string;
    expectedArrival: Date | null;
    status: string;
  }>;
  overduePayables: Array<{
    id: string;
    invoiceNo: string;
    partyName: string;
    dueDate: Date;
    balance: string;
    currencyCode: string;
    kind: string;
  }>;
}

const IN_PROGRESS_STATUSES: string[] = [
  ShipmentStatus.ORDERED,
  ShipmentStatus.SHIPPED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED,
  ShipmentStatus.CUSTOM_CLEARANCE,
];

const OPEN_INVOICE_STATUSES: string[] = ['PENDING', 'PARTIAL', 'OVERDUE'];

function humanise(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Read model for the landing page. Everything here answers one question: what
 * are we importing, and what is it costing us.
 */
export class DashboardService {
  async snapshot(monthsOfHistory = 6): Promise<DashboardSnapshot> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - (monthsOfHistory - 1), 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalShipments,
      inProgress,
      awaitingReceipt,
      statusGroups,
      payableVendor,
      payableAgent,
      monthCost,
      stockValue,
      pendingInvoices,
      arrivingSoon,
      overdueVendor,
      overdueAgent,
      historicShipments,
      lifetimeCost,
    ] = await Promise.all([
      prisma.shipment.count({ where: { deletedAt: null } }),
      prisma.shipment.count({ where: { deletedAt: null, status: { in: IN_PROGRESS_STATUSES } } }),
      prisma.shipment.count({
        where: { deletedAt: null, status: { in: [ShipmentStatus.ARRIVED, ShipmentStatus.CUSTOM_CLEARANCE] } },
      }),
      prisma.shipment.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: { in: OPEN_INVOICE_STATUSES } },
        _sum: { balanceAmount: true },
      }),
      prisma.agentInvoice.aggregate({
        where: { deletedAt: null, status: { in: OPEN_INVOICE_STATUSES } },
        _sum: { balanceAmount: true },
      }),
      prisma.shipment.aggregate({
        where: { deletedAt: null, createdAt: { gte: monthStart } },
        _sum: { totalLandedCost: true },
      }),
      prisma.stockBalance.aggregate({ _sum: { totalValue: true } }),
      prisma.vendorInvoice.count({
        where: { deletedAt: null, status: { in: OPEN_INVOICE_STATUSES } },
      }),
      prisma.shipment.findMany({
        where: {
          deletedAt: null,
          status: { in: IN_PROGRESS_STATUSES },
          expectedArrival: { gte: now },
        },
        orderBy: { expectedArrival: 'asc' },
        take: 8,
        select: {
          id: true,
          shipmentNo: true,
          destinationPort: true,
          expectedArrival: true,
          status: true,
          supplier: { select: { name: true } },
        },
      }),
      prisma.vendorInvoice.findMany({
        where: { deletedAt: null, status: { in: OPEN_INVOICE_STATUSES }, dueDate: { lt: now } },
        orderBy: { dueDate: 'asc' },
        take: 6,
        select: {
          id: true,
          invoiceNo: true,
          dueDate: true,
          balanceAmount: true,
          currencyCode: true,
          vendor: { select: { name: true } },
        },
      }),
      prisma.agentInvoice.findMany({
        where: { deletedAt: null, status: { in: OPEN_INVOICE_STATUSES }, dueDate: { lt: now } },
        orderBy: { dueDate: 'asc' },
        take: 6,
        select: {
          id: true,
          invoiceNo: true,
          dueDate: true,
          balanceAmount: true,
          currencyCode: true,
          clearingAgent: { select: { name: true } },
        },
      }),
      prisma.shipment.findMany({
        where: { deletedAt: null, createdAt: { gte: periodStart } },
        select: { createdAt: true, goodsValue: true, additionalCost: true },
      }),
      prisma.shipment.aggregate({
        where: { deletedAt: null, status: { not: ShipmentStatus.CANCELLED } },
        _sum: {
          freightCost: true,
          dutyCost: true,
          clearingCost: true,
          otherCost: true,
          goodsValue: true,
        },
      }),
    ]);

    const vendorOutstanding = toDecimal(payableVendor._sum.balanceAmount).plus(
      toDecimal(payableAgent._sum.balanceAmount),
    );

    const buckets = new Map<string, MonthlyCostPoint>();

    for (let index = 0; index < monthsOfHistory; index += 1) {
      const date = new Date(periodStart.getFullYear(), periodStart.getMonth() + index, 1);
      buckets.set(monthKey(date), {
        period: date.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        goodsValue: 0,
        additionalCost: 0,
        total: 0,
      });
    }

    for (const shipment of historicShipments) {
      const bucket = buckets.get(monthKey(shipment.createdAt));

      if (bucket) {
        bucket.goodsValue += toDecimal(shipment.goodsValue).toNumber();
        bucket.additionalCost += toDecimal(shipment.additionalCost).toNumber();
      }
    }

    const monthlyCosts = [...buckets.values()].map((bucket) => ({
      period: bucket.period,
      goodsValue: Number(bucket.goodsValue.toFixed(2)),
      additionalCost: Number(bucket.additionalCost.toFixed(2)),
      total: Number((bucket.goodsValue + bucket.additionalCost).toFixed(2)),
    }));

    const costBreakdown: CostGroupBreakdown[] = (
      [
        [CostGroup.GOODS, lifetimeCost._sum.goodsValue],
        [CostGroup.FREIGHT, lifetimeCost._sum.freightCost],
        [CostGroup.DUTY, lifetimeCost._sum.dutyCost],
        [CostGroup.CLEARING, lifetimeCost._sum.clearingCost],
        [CostGroup.OTHER, lifetimeCost._sum.otherCost],
      ] as Array<[CostGroup, Prisma.Decimal | null]>
    )
      .map(([group, amount]) => ({
        group,
        label: COST_GROUP_LABELS[group],
        amount: Number(toDecimal(amount).toFixed(2)),
      }))
      .filter((entry) => entry.amount > 0);

    return {
      metrics: [
        {
          key: 'totalShipments',
          label: 'Total shipments',
          value: totalShipments.toLocaleString(),
          intent: 'neutral',
        },
        {
          key: 'inProgress',
          label: 'In progress',
          value: inProgress.toLocaleString(),
          changeLabel: 'Ordered through customs',
          intent: 'positive',
        },
        {
          key: 'awaitingReceipt',
          label: 'Awaiting goods receipt',
          value: awaitingReceipt.toLocaleString(),
          intent: awaitingReceipt > 0 ? 'warning' : 'neutral',
        },
        {
          key: 'pendingInvoices',
          label: 'Invoices awaiting payment',
          value: pendingInvoices.toLocaleString(),
          intent: pendingInvoices > 0 ? 'warning' : 'neutral',
        },
        {
          key: 'payable',
          label: 'Outstanding payable',
          value: vendorOutstanding.toFixed(2),
          intent: 'warning',
          isMoney: true,
        },
        {
          key: 'monthCost',
          label: 'Import cost this month',
          value: toDecimal(monthCost._sum.totalLandedCost).toFixed(2),
          intent: 'negative',
          isMoney: true,
        },
        {
          key: 'stockValue',
          label: 'Stock value on hand',
          value: toDecimal(stockValue._sum.totalValue).toFixed(2),
          intent: 'positive',
          isMoney: true,
        },
      ],
      shipmentsByStatus: statusGroups.map((group) => ({
        status: group.status,
        label: humanise(group.status),
        count: group._count._all,
      })),
      monthlyCosts,
      costBreakdown,
      arrivingSoon: arrivingSoon.map((shipment) => ({
        id: shipment.id,
        shipmentNo: shipment.shipmentNo,
        supplierName: shipment.supplier.name,
        destinationPort: shipment.destinationPort,
        expectedArrival: shipment.expectedArrival,
        status: shipment.status,
      })),
      overduePayables: [
        ...overdueVendor.map((invoice) => ({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          partyName: invoice.vendor.name,
          dueDate: invoice.dueDate,
          balance: toDecimal(invoice.balanceAmount).toFixed(2),
          currencyCode: invoice.currencyCode,
          kind: 'Vendor',
        })),
        ...overdueAgent.map((invoice) => ({
          id: invoice.id,
          invoiceNo: invoice.invoiceNo,
          partyName: invoice.clearingAgent.name,
          dueDate: invoice.dueDate,
          balance: toDecimal(invoice.balanceAmount).toFixed(2),
          currencyCode: invoice.currencyCode,
          kind: 'Agent',
        })),
      ].sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime()),
    };
  }
}

export const dashboardService = new DashboardService();
