import { Prisma } from '@prisma/client';
import { calculateDocumentTotals, calculateLine, convertToBase, roundAmount, toDecimal } from '@/lib/money';
import { InvoiceStatus } from '@/types/enums';
import type { DocumentLineInput } from '@/schemas/billing.schema';

export interface CalculatedLine {
  lineNumber: number;
  description: string;
  serviceCode: string | null;
  quantity: Prisma.Decimal;
  unitRate: Prisma.Decimal;
  discountRate: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  lineSubTotal: Prisma.Decimal;
  lineTaxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedDocument {
  lines: CalculatedLine[];
  subTotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
  baseGrandTotal: Prisma.Decimal;
}

/**
 * Single source of truth for document arithmetic. Every invoice and purchase
 * order recomputes its totals here rather than trusting numbers sent by the
 * browser.
 */
export class InvoiceCalculator {
  static calculate(
    items: DocumentLineInput[],
    exchangeRate: number | Prisma.Decimal,
    extraCharges: Array<number | Prisma.Decimal> = [],
  ): CalculatedDocument {
    const computed = items.map((item, index) => {
      const result = calculateLine(item);

      return {
        result,
        line: {
          lineNumber: index + 1,
          description: item.description,
          serviceCode: item.serviceCode ?? null,
          quantity: toDecimal(item.quantity),
          unitRate: toDecimal(item.unitRate),
          discountRate: toDecimal(item.discountRate),
          taxRate: toDecimal(item.taxRate),
          lineSubTotal: result.lineSubTotal,
          lineTaxAmount: result.lineTaxAmount,
          lineTotal: result.lineTotal,
        } satisfies CalculatedLine,
      };
    });

    const totals = calculateDocumentTotals(computed.map((entry) => entry.result));
    const additional = extraCharges.reduce<Prisma.Decimal>(
      (total, charge) => total.plus(toDecimal(charge)),
      new Prisma.Decimal(0),
    );

    const grandTotal = roundAmount(totals.grandTotal.plus(additional));

    return {
      lines: computed.map((entry) => entry.line),
      subTotal: totals.subTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      grandTotal,
      baseGrandTotal: convertToBase(grandTotal, exchangeRate),
    };
  }

  /**
   * Derives the document status from what has actually been settled. Status is
   * never accepted from the client.
   */
  static deriveStatus(
    grandTotal: Prisma.Decimal,
    settledAmount: Prisma.Decimal,
    dueDate: Date,
    asOf: Date = new Date(),
  ): InvoiceStatus {
    if (settledAmount.greaterThanOrEqualTo(grandTotal) && !grandTotal.isZero()) {
      return InvoiceStatus.PAID;
    }

    const isOverdue = dueDate < asOf;

    if (settledAmount.greaterThan(0)) {
      return isOverdue ? InvoiceStatus.OVERDUE : InvoiceStatus.PARTIAL;
    }

    return isOverdue ? InvoiceStatus.OVERDUE : InvoiceStatus.PENDING;
  }
}
