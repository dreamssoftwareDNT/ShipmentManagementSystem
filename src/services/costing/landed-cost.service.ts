import { Prisma } from '@prisma/client';
import { roundAmount, toDecimal } from '@/lib/money';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { prisma } from '@/database/prisma';
import { UnitOfWork, type DatabaseClient, type TransactionClient } from '@/database/unit-of-work';
import { CostAllocationBasis, CostGroup } from '@/types/enums';

const ZERO = new Prisma.Decimal(0);
const POSTED_INVOICE_STATUSES = { notIn: ['DRAFT', 'CANCELLED'] };

export interface CostComponent {
  costGroup: string;
  source: string;
  reference: string;
  amount: Prisma.Decimal;
}

export interface ShipmentCostBreakdown {
  goodsValue: Prisma.Decimal;
  freightCost: Prisma.Decimal;
  dutyCost: Prisma.Decimal;
  clearingCost: Prisma.Decimal;
  otherCost: Prisma.Decimal;
  additionalCost: Prisma.Decimal;
  totalLandedCost: Prisma.Decimal;
  components: CostComponent[];
}

export interface AllocatedLine {
  shipmentItemId: string;
  productId: string;
  lineNumber: number;
  quantityOrdered: Prisma.Decimal;
  baseLineTotal: Prisma.Decimal;
  allocatedCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  unitLandedCost: Prisma.Decimal;
  sharePercent: Prisma.Decimal;
}

const COST_GROUP_BUCKET: Record<string, 'freight' | 'duty' | 'clearing' | 'other'> = {
  [CostGroup.FREIGHT]: 'freight',
  [CostGroup.INSURANCE]: 'freight',
  [CostGroup.DUTY]: 'duty',
  [CostGroup.CLEARING]: 'clearing',
  [CostGroup.PORT_CHARGES]: 'clearing',
  [CostGroup.TRANSPORT]: 'other',
  [CostGroup.BANK_CHARGES]: 'other',
  [CostGroup.OTHER]: 'other',
};

/**
 * Works out what a shipment actually cost and spreads that cost across its line
 * items so every product carries a defensible landed unit cost.
 *
 * The goods value comes from the shipment lines themselves. Every other cost
 * arrives from a posted document: vendor invoices that are not the supplier's
 * own goods invoice, clearing agent invoices, and shipment expenses. A vendor
 * invoice marked GOODS is deliberately skipped, because its value is already
 * represented by the lines.
 */
export class LandedCostService {
  async collectCosts(
    shipmentId: string,
    client: DatabaseClient = prisma,
  ): Promise<ShipmentCostBreakdown> {
    const [items, vendorInvoices, agentInvoices, expenses] = await Promise.all([
      client.shipmentItem.findMany({
        where: { shipmentId, deletedAt: null },
        select: { baseLineTotal: true },
      }),
      client.vendorInvoice.findMany({
        where: {
          shipmentId,
          deletedAt: null,
          status: POSTED_INVOICE_STATUSES,
          costGroup: { not: CostGroup.GOODS },
        },
        select: { invoiceNo: true, costGroup: true, baseGrandTotal: true },
      }),
      client.agentInvoice.findMany({
        where: { shipmentId, deletedAt: null, status: POSTED_INVOICE_STATUSES },
        select: {
          invoiceNo: true,
          baseGrandTotal: true,
          dutyAmount: true,
          salesTaxAmount: true,
          exchangeRate: true,
        },
      }),
      client.expense.findMany({
        where: {
          shipmentId,
          deletedAt: null,
          status: { not: 'REJECTED' },
          isLandedCost: true,
        },
        select: {
          expenseNo: true,
          baseAmount: true,
          category: { select: { name: true, costGroup: true } },
        },
      }),
    ]);

    const components: CostComponent[] = [];
    const buckets = { freight: ZERO, duty: ZERO, clearing: ZERO, other: ZERO };

    const addTo = (costGroup: string, amount: Prisma.Decimal): void => {
      const bucket = COST_GROUP_BUCKET[costGroup] ?? 'other';
      buckets[bucket] = buckets[bucket].plus(amount);
    };

    for (const invoice of vendorInvoices) {
      const amount = toDecimal(invoice.baseGrandTotal);
      components.push({
        costGroup: invoice.costGroup,
        source: 'Vendor invoice',
        reference: invoice.invoiceNo,
        amount,
      });
      addTo(invoice.costGroup, amount);
    }

    for (const invoice of agentInvoices) {
      const total = toDecimal(invoice.baseGrandTotal);
      const rate = toDecimal(invoice.exchangeRate);
      const dutyPortion = roundAmount(
        toDecimal(invoice.dutyAmount).plus(toDecimal(invoice.salesTaxAmount)).times(rate),
      );
      const servicePortion = roundAmount(total.minus(dutyPortion));

      if (dutyPortion.greaterThan(0)) {
        components.push({
          costGroup: CostGroup.DUTY,
          source: 'Agent invoice',
          reference: invoice.invoiceNo,
          amount: dutyPortion,
        });
        addTo(CostGroup.DUTY, dutyPortion);
      }

      if (servicePortion.greaterThan(0)) {
        components.push({
          costGroup: CostGroup.CLEARING,
          source: 'Agent invoice',
          reference: invoice.invoiceNo,
          amount: servicePortion,
        });
        addTo(CostGroup.CLEARING, servicePortion);
      }
    }

    for (const expense of expenses) {
      const amount = toDecimal(expense.baseAmount);
      const costGroup = expense.category?.costGroup ?? CostGroup.OTHER;
      components.push({
        costGroup,
        source: 'Expense',
        reference: expense.expenseNo,
        amount,
      });
      addTo(costGroup, amount);
    }

    const goodsValue = roundAmount(
      items.reduce<Prisma.Decimal>((total, item) => total.plus(toDecimal(item.baseLineTotal)), ZERO),
    );

    const freightCost = roundAmount(buckets.freight);
    const dutyCost = roundAmount(buckets.duty);
    const clearingCost = roundAmount(buckets.clearing);
    const otherCost = roundAmount(buckets.other);
    const additionalCost = roundAmount(
      freightCost.plus(dutyCost).plus(clearingCost).plus(otherCost),
    );

    return {
      goodsValue,
      freightCost,
      dutyCost,
      clearingCost,
      otherCost,
      additionalCost,
      totalLandedCost: roundAmount(goodsValue.plus(additionalCost)),
      components: components.sort((left, right) => right.amount.comparedTo(left.amount)),
    };
  }

  /**
   * Spreads the additional cost across the lines on the chosen basis. The last
   * line absorbs any rounding remainder so the allocated total always equals
   * the cost that was collected, to the cent.
   */
  allocate(
    lines: Array<{
      id: string;
      productId: string;
      lineNumber: number;
      quantityOrdered: Prisma.Decimal;
      baseLineTotal: Prisma.Decimal;
      lineWeightKg: Prisma.Decimal;
      lineVolumeCbm: Prisma.Decimal;
    }>,
    additionalCost: Prisma.Decimal,
    basis: string,
  ): AllocatedLine[] {
    if (lines.length === 0) {
      return [];
    }

    const weightOf = (line: (typeof lines)[number]): Prisma.Decimal => {
      switch (basis) {
        case CostAllocationBasis.QUANTITY:
          return toDecimal(line.quantityOrdered);
        case CostAllocationBasis.WEIGHT:
          return toDecimal(line.lineWeightKg);
        case CostAllocationBasis.VOLUME:
          return toDecimal(line.lineVolumeCbm);
        default:
          return toDecimal(line.baseLineTotal);
      }
    };

    let basisTotal = lines.reduce<Prisma.Decimal>((total, line) => total.plus(weightOf(line)), ZERO);
    const useEqualSplit = basisTotal.lessThanOrEqualTo(0);

    if (useEqualSplit) {
      basisTotal = new Prisma.Decimal(lines.length);
    }

    let distributed = ZERO;

    return lines.map((line, index) => {
      const share = useEqualSplit ? new Prisma.Decimal(1) : weightOf(line);
      const isLast = index === lines.length - 1;

      const allocatedCost = isLast
        ? roundAmount(additionalCost.minus(distributed))
        : roundAmount(additionalCost.times(share).dividedBy(basisTotal));

      distributed = distributed.plus(allocatedCost);

      const baseLineTotal = toDecimal(line.baseLineTotal);
      const totalCost = roundAmount(baseLineTotal.plus(allocatedCost));
      const quantity = toDecimal(line.quantityOrdered);

      return {
        shipmentItemId: line.id,
        productId: line.productId,
        lineNumber: line.lineNumber,
        quantityOrdered: quantity,
        baseLineTotal,
        allocatedCost,
        totalCost,
        unitLandedCost: quantity.greaterThan(0)
          ? totalCost.dividedBy(quantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
          : ZERO,
        sharePercent: basisTotal.greaterThan(0)
          ? share.dividedBy(basisTotal).times(100).toDecimalPlaces(2)
          : ZERO,
      };
    });
  }

  /**
   * Recomputes the whole shipment and writes the result back. Called whenever a
   * cost document or a line item changes, so the figures never go stale.
   */
  async recalculate(shipmentId: string, tx: TransactionClient): Promise<ShipmentCostBreakdown> {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      select: { id: true, costAllocationBasis: true },
    });

    if (!shipment) {
      throw new NotFoundError('Shipment', shipmentId);
    }

    const breakdown = await this.collectCosts(shipmentId, tx);

    const lines = await tx.shipmentItem.findMany({
      where: { shipmentId, deletedAt: null },
      orderBy: { lineNumber: 'asc' },
      select: {
        id: true,
        productId: true,
        lineNumber: true,
        quantityOrdered: true,
        baseLineTotal: true,
        lineWeightKg: true,
        lineVolumeCbm: true,
      },
    });

    const allocations = this.allocate(
      lines,
      breakdown.additionalCost,
      shipment.costAllocationBasis,
    );

    for (const allocation of allocations) {
      await tx.shipmentItem.update({
        where: { id: allocation.shipmentItemId },
        data: {
          allocatedCost: allocation.allocatedCost,
          totalCost: allocation.totalCost,
          unitLandedCost: allocation.unitLandedCost,
        },
      });
    }

    const budgeted = await tx.shipmentCharge.aggregate({
      where: { shipmentId, deletedAt: null },
      _sum: { baseAmount: true },
    });

    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        goodsValue: breakdown.goodsValue,
        freightCost: breakdown.freightCost,
        dutyCost: breakdown.dutyCost,
        clearingCost: breakdown.clearingCost,
        otherCost: breakdown.otherCost,
        additionalCost: breakdown.additionalCost,
        totalLandedCost: breakdown.totalLandedCost,
        budgetedCost: budgeted._sum.baseAmount ?? ZERO,
      },
    });

    return breakdown;
  }

  async recalculateStandalone(shipmentId: string): Promise<ShipmentCostBreakdown> {
    return UnitOfWork.run((tx) => this.recalculate(shipmentId, tx));
  }

  async changeAllocationBasis(
    shipmentId: string,
    basis: string,
  ): Promise<ShipmentCostBreakdown> {
    if (!Object.values(CostAllocationBasis).includes(basis as CostAllocationBasis)) {
      throw new BusinessRuleError(`${basis} is not a valid allocation basis`);
    }

    return UnitOfWork.run(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { costAllocationBasis: basis },
      });

      return this.recalculate(shipmentId, tx);
    });
  }

  async breakdownWithLines(shipmentId: string) {
    const [breakdown, lines] = await Promise.all([
      this.collectCosts(shipmentId),
      prisma.shipmentItem.findMany({
        where: { shipmentId, deletedAt: null },
        orderBy: { lineNumber: 'asc' },
        include: {
          product: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
        },
      }),
    ]);

    return { breakdown, lines };
  }
}

export const landedCostService = new LandedCostService();
