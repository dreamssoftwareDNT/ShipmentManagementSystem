import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { toDecimal } from '@/lib/money';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'text' | 'money' | 'number' | 'date';
}

export interface ReportResult {
  key: string;
  title: string;
  generatedAt: Date;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  totals?: Record<string, string>;
}

export interface ReportFilter {
  from?: Date;
  to?: Date;
  customerId?: string;
  vendorId?: string;
  status?: string;
}

const OPEN_INVOICE_STATUSES: string[] = ['PENDING', 'PARTIAL', 'OVERDUE'];

function dateRange(filter: ReportFilter): { gte?: Date; lte?: Date } | undefined {
  if (!filter.from && !filter.to) {
    return undefined;
  }

  return {
    ...(filter.from ? { gte: filter.from } : {}),
    ...(filter.to ? { lte: filter.to } : {}),
  };
}

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Every report returns a column definition alongside its rows so the table,
 * the CSV export and the print view all render from one description.
 */
export class ReportService {
  async shipmentRegister(filter: ReportFilter): Promise<ReportResult> {
    const shipments = await prisma.shipment.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
        ...(dateRange(filter) ? { shippingDate: dateRange(filter) } : {}),
      },
      orderBy: { shippingDate: 'desc' },
      take: 5000,
      include: {
        customer: { select: { name: true } },
        carrier: { select: { name: true } },
      },
    });

    return {
      key: 'shipment-register',
      title: 'Shipment register',
      generatedAt: new Date(),
      columns: [
        { key: 'shipmentNo', label: 'Shipment' },
        { key: 'customer', label: 'Customer' },
        { key: 'route', label: 'Route' },
        { key: 'mode', label: 'Mode' },
        { key: 'carrier', label: 'Carrier' },
        { key: 'shippingDate', label: 'Shipped', format: 'date' },
        { key: 'expectedArrival', label: 'ETA', format: 'date' },
        { key: 'status', label: 'Status' },
        { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
        { key: 'cost', label: 'Cost', align: 'right', format: 'money' },
        { key: 'profit', label: 'Profit', align: 'right', format: 'money' },
      ],
      rows: shipments.map((shipment) => ({
        shipmentNo: shipment.shipmentNo,
        customer: shipment.customer.name,
        route: `${shipment.originPort} to ${shipment.destinationPort}`,
        mode: shipment.transportMode.replace(/_/g, ' '),
        carrier: shipment.carrier?.name ?? null,
        shippingDate: formatDate(shipment.shippingDate),
        expectedArrival: formatDate(shipment.expectedArrival),
        status: shipment.status.replace(/_/g, ' '),
        revenue: toDecimal(shipment.actualRevenue).toFixed(2),
        cost: toDecimal(shipment.actualCost).toFixed(2),
        profit: toDecimal(shipment.actualRevenue).minus(toDecimal(shipment.actualCost)).toFixed(2),
      })),
      totals: this.sumColumns(
        shipments.map((shipment) => ({
          revenue: toDecimal(shipment.actualRevenue),
          cost: toDecimal(shipment.actualCost),
          profit: toDecimal(shipment.actualRevenue).minus(toDecimal(shipment.actualCost)),
        })),
      ),
    };
  }

  async profitAndLoss(filter: ReportFilter): Promise<ReportResult> {
    const range = dateRange(filter);
    const postedOnly = { notIn: ['DRAFT', 'CANCELLED'] };

    const [revenue, vendorCost, agentCost, expenses] = await Promise.all([
      prisma.freightInvoice.aggregate({
        where: { deletedAt: null, status: postedOnly, ...(range ? { invoiceDate: range } : {}) },
        _sum: { baseGrandTotal: true },
      }),
      prisma.vendorInvoice.aggregate({
        where: { deletedAt: null, status: postedOnly, ...(range ? { invoiceDate: range } : {}) },
        _sum: { baseGrandTotal: true },
      }),
      prisma.agentInvoice.aggregate({
        where: { deletedAt: null, status: postedOnly, ...(range ? { invoiceDate: range } : {}) },
        _sum: { baseGrandTotal: true },
      }),
      prisma.expense.aggregate({
        where: {
          deletedAt: null,
          status: { not: 'REJECTED' },
          ...(range ? { expenseDate: range } : {}),
        },
        _sum: { baseAmount: true },
      }),
    ]);

    const revenueTotal = toDecimal(revenue._sum.baseGrandTotal);
    const vendorTotal = toDecimal(vendorCost._sum.baseGrandTotal);
    const agentTotal = toDecimal(agentCost._sum.baseGrandTotal);
    const expenseTotal = toDecimal(expenses._sum.baseAmount);
    const costTotal = vendorTotal.plus(agentTotal).plus(expenseTotal);
    const profit = revenueTotal.minus(costTotal);

    const margin = revenueTotal.isZero()
      ? new Prisma.Decimal(0)
      : profit.dividedBy(revenueTotal).times(100).toDecimalPlaces(2);

    return {
      key: 'profit-and-loss',
      title: 'Profit and loss',
      generatedAt: new Date(),
      columns: [
        { key: 'line', label: 'Line' },
        { key: 'amount', label: 'Amount', align: 'right', format: 'money' },
      ],
      rows: [
        { line: 'Freight revenue', amount: revenueTotal.toFixed(2) },
        { line: 'Carrier and vendor cost', amount: vendorTotal.toFixed(2) },
        { line: 'Clearing agent cost', amount: agentTotal.toFixed(2) },
        { line: 'Operating expenses', amount: expenseTotal.toFixed(2) },
        { line: 'Total cost', amount: costTotal.toFixed(2) },
        { line: 'Net profit', amount: profit.toFixed(2) },
        { line: 'Margin percent', amount: margin.toFixed(2) },
      ],
    };
  }

  async customerOutstanding(filter: ReportFilter): Promise<ReportResult> {
    const invoices = await prisma.freightInvoice.findMany({
      where: {
        deletedAt: null,
        status: { in: OPEN_INVOICE_STATUSES },
        ...(filter.customerId ? { customerId: filter.customerId } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: { customer: { select: { name: true, code: true } } },
      take: 5000,
    });

    const today = new Date();

    return {
      key: 'customer-outstanding',
      title: 'Customer outstanding',
      generatedAt: new Date(),
      columns: [
        { key: 'invoiceNo', label: 'Invoice' },
        { key: 'customer', label: 'Customer' },
        { key: 'invoiceDate', label: 'Issued', format: 'date' },
        { key: 'dueDate', label: 'Due', format: 'date' },
        { key: 'daysOverdue', label: 'Days overdue', align: 'right', format: 'number' },
        { key: 'currencyCode', label: 'Currency' },
        { key: 'grandTotal', label: 'Invoiced', align: 'right', format: 'money' },
        { key: 'received', label: 'Received', align: 'right', format: 'money' },
        { key: 'balance', label: 'Balance', align: 'right', format: 'money' },
      ],
      rows: invoices.map((invoice) => ({
        invoiceNo: invoice.invoiceNo,
        customer: invoice.customer.name,
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        daysOverdue: Math.max(
          0,
          Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86_400_000),
        ),
        currencyCode: invoice.currencyCode,
        grandTotal: toDecimal(invoice.grandTotal).toFixed(2),
        received: toDecimal(invoice.receivedAmount).toFixed(2),
        balance: toDecimal(invoice.balanceAmount).toFixed(2),
      })),
      totals: this.sumColumns(
        invoices.map((invoice) => ({
          grandTotal: toDecimal(invoice.grandTotal),
          received: toDecimal(invoice.receivedAmount),
          balance: toDecimal(invoice.balanceAmount),
        })),
      ),
    };
  }

  async vendorOutstanding(filter: ReportFilter): Promise<ReportResult> {
    const invoices = await prisma.vendorInvoice.findMany({
      where: {
        deletedAt: null,
        status: { in: OPEN_INVOICE_STATUSES },
        ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
      },
      orderBy: { dueDate: 'asc' },
      include: { vendor: { select: { name: true } } },
      take: 5000,
    });

    return {
      key: 'vendor-outstanding',
      title: 'Vendor outstanding',
      generatedAt: new Date(),
      columns: [
        { key: 'invoiceNo', label: 'Invoice' },
        { key: 'vendor', label: 'Vendor' },
        { key: 'invoiceDate', label: 'Received', format: 'date' },
        { key: 'dueDate', label: 'Due', format: 'date' },
        { key: 'currencyCode', label: 'Currency' },
        { key: 'grandTotal', label: 'Invoiced', align: 'right', format: 'money' },
        { key: 'paid', label: 'Paid', align: 'right', format: 'money' },
        { key: 'balance', label: 'Balance', align: 'right', format: 'money' },
      ],
      rows: invoices.map((invoice) => ({
        invoiceNo: invoice.invoiceNo,
        vendor: invoice.vendor.name,
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        currencyCode: invoice.currencyCode,
        grandTotal: toDecimal(invoice.grandTotal).toFixed(2),
        paid: toDecimal(invoice.paidAmount).toFixed(2),
        balance: toDecimal(invoice.balanceAmount).toFixed(2),
      })),
      totals: this.sumColumns(
        invoices.map((invoice) => ({
          grandTotal: toDecimal(invoice.grandTotal),
          paid: toDecimal(invoice.paidAmount),
          balance: toDecimal(invoice.balanceAmount),
        })),
      ),
    };
  }

  async paymentRegister(filter: ReportFilter): Promise<ReportResult> {
    const range = dateRange(filter);

    const [receipts, payments] = await Promise.all([
      prisma.customerPayment.findMany({
        where: { deletedAt: null, status: 'POSTED', ...(range ? { paymentDate: range } : {}) },
        include: { customer: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
        take: 3000,
      }),
      prisma.vendorPayment.findMany({
        where: { deletedAt: null, status: 'POSTED', ...(range ? { paymentDate: range } : {}) },
        include: { vendor: { select: { name: true } } },
        orderBy: { paymentDate: 'desc' },
        take: 3000,
      }),
    ]);

    const rows = [
      ...receipts.map((receipt) => ({
        reference: receipt.receiptNo,
        direction: 'Received',
        party: receipt.customer.name,
        paymentDate: formatDate(receipt.paymentDate),
        method: receipt.paymentMethod.replace(/_/g, ' '),
        currencyCode: receipt.currencyCode,
        amount: toDecimal(receipt.amount).toFixed(2),
        baseAmount: toDecimal(receipt.baseAmount).toFixed(2),
      })),
      ...payments.map((payment) => ({
        reference: payment.paymentNo,
        direction: 'Paid',
        party: payment.vendor.name,
        paymentDate: formatDate(payment.paymentDate),
        method: payment.paymentMethod.replace(/_/g, ' '),
        currencyCode: payment.currencyCode,
        amount: toDecimal(payment.amount).toFixed(2),
        baseAmount: toDecimal(payment.baseAmount).toFixed(2),
      })),
    ].sort((left, right) => (left.paymentDate ?? '').localeCompare(right.paymentDate ?? '') * -1);

    return {
      key: 'payment-register',
      title: 'Payment register',
      generatedAt: new Date(),
      columns: [
        { key: 'reference', label: 'Reference' },
        { key: 'direction', label: 'Direction' },
        { key: 'party', label: 'Party' },
        { key: 'paymentDate', label: 'Date', format: 'date' },
        { key: 'method', label: 'Method' },
        { key: 'currencyCode', label: 'Currency' },
        { key: 'amount', label: 'Amount', align: 'right', format: 'money' },
        { key: 'baseAmount', label: 'Base amount', align: 'right', format: 'money' },
      ],
      rows,
    };
  }

  async expenseAnalysis(filter: ReportFilter): Promise<ReportResult> {
    const range = dateRange(filter);

    const grouped = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        deletedAt: null,
        status: { not: 'REJECTED' },
        ...(range ? { expenseDate: range } : {}),
      },
      _sum: { baseAmount: true },
      _count: { _all: true },
    });

    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: grouped.map((group) => group.categoryId) } },
      select: { id: true, name: true, code: true },
    });
    const lookup = new Map(categories.map((category) => [category.id, category]));

    const total = grouped.reduce<Prisma.Decimal>(
      (sum, group) => sum.plus(toDecimal(group._sum.baseAmount)),
      new Prisma.Decimal(0),
    );

    return {
      key: 'expense-analysis',
      title: 'Expense analysis',
      generatedAt: new Date(),
      columns: [
        { key: 'category', label: 'Category' },
        { key: 'count', label: 'Entries', align: 'right', format: 'number' },
        { key: 'amount', label: 'Amount', align: 'right', format: 'money' },
        { key: 'share', label: 'Share percent', align: 'right', format: 'number' },
      ],
      rows: grouped
        .map((group) => {
          const amount = toDecimal(group._sum.baseAmount);

          return {
            category: lookup.get(group.categoryId)?.name ?? 'Uncategorised',
            count: group._count._all,
            amount: amount.toFixed(2),
            share: total.isZero() ? '0.00' : amount.dividedBy(total).times(100).toFixed(2),
          };
        })
        .sort((left, right) => Number(right.amount) - Number(left.amount)),
      totals: { amount: total.toFixed(2) },
    };
  }

  async run(key: string, filter: ReportFilter): Promise<ReportResult> {
    switch (key) {
      case 'shipment-register':
        return this.shipmentRegister(filter);
      case 'profit-and-loss':
        return this.profitAndLoss(filter);
      case 'customer-outstanding':
        return this.customerOutstanding(filter);
      case 'vendor-outstanding':
        return this.vendorOutstanding(filter);
      case 'payment-register':
        return this.paymentRegister(filter);
      case 'expense-analysis':
        return this.expenseAnalysis(filter);
      default:
        throw new Error(`Unknown report: ${key}`);
    }
  }

  toCsv(report: ReportResult): string {
    const escape = (value: string | number | null): string => {
      const text = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const header = report.columns.map((column) => escape(column.label)).join(',');
    const body = report.rows
      .map((row) => report.columns.map((column) => escape(row[column.key] ?? '')).join(','))
      .join('\n');

    return `${header}\n${body}\n`;
  }

  private sumColumns(rows: Array<Record<string, Prisma.Decimal>>): Record<string, string> {
    const totals: Record<string, Prisma.Decimal> = {};

    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        totals[key] = (totals[key] ?? new Prisma.Decimal(0)).plus(value);
      }
    }

    return Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)]),
    );
  }
}

export const REPORT_CATALOGUE = [
  {
    key: 'shipment-register',
    title: 'Shipment register',
    description: 'Every shipment with its route, milestones and realised margin.',
  },
  {
    key: 'profit-and-loss',
    title: 'Profit and loss',
    description: 'Revenue against carrier, agent and operating cost for the period.',
  },
  {
    key: 'customer-outstanding',
    title: 'Customer outstanding',
    description: 'Unsettled customer invoices with ageing in days.',
  },
  {
    key: 'vendor-outstanding',
    title: 'Vendor outstanding',
    description: 'Unpaid vendor invoices ordered by due date.',
  },
  {
    key: 'payment-register',
    title: 'Payment register',
    description: 'All receipts and payments posted in the period.',
  },
  {
    key: 'expense-analysis',
    title: 'Expense analysis',
    description: 'Operating expenses grouped by category with share of spend.',
  },
] as const;

export const reportService = new ReportService();
