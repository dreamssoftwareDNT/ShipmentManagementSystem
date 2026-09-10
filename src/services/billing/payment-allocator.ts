import { Prisma } from '@prisma/client';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { convertToBase, roundAmount, toDecimal } from '@/lib/money';
import { InvoiceStatus } from '@/types/enums';
import { InvoiceCalculator } from './invoice-calculator';
import type { TransactionClient } from '@/database/unit-of-work';
import type { PaymentAllocationInput } from './types';

export interface AllocatableInvoice {
  id: string;
  invoiceNo: string;
  currencyCode: string;
  grandTotal: Prisma.Decimal;
  settledAmount: Prisma.Decimal;
  dueDate: Date;
  status: string;
  partyId: string;
}

export interface AppliedAllocation {
  invoiceId: string;
  invoiceNo: string;
  amount: Prisma.Decimal;
  baseAmount: Prisma.Decimal;
  settledAmount: Prisma.Decimal;
  outstandingAfter: Prisma.Decimal;
  status: InvoiceStatus;
}

export interface AllocationContext {
  partyId: string;
  paymentAmount: Prisma.Decimal;
  currencyCode: string;
  exchangeRate: Prisma.Decimal;
  allocations: PaymentAllocationInput[];
  loadInvoice: (invoiceId: string, tx: TransactionClient) => Promise<AllocatableInvoice | null>;
}

/**
 * Validates and applies a payment against outstanding invoices.
 *
 * The allocator refuses to over apply a payment, refuses to over settle an
 * invoice, and refuses to mix currencies, because any of those would make the
 * party statement irreconcilable.
 */
export class PaymentAllocator {
  static async apply(
    context: AllocationContext,
    tx: TransactionClient,
  ): Promise<AppliedAllocation[]> {
    if (context.allocations.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const applied: AppliedAllocation[] = [];
    let allocatedTotal = new Prisma.Decimal(0);

    for (const allocation of context.allocations) {
      if (seen.has(allocation.invoiceId)) {
        throw new BusinessRuleError('The same invoice cannot be allocated twice on one payment');
      }
      seen.add(allocation.invoiceId);

      const invoice = await context.loadInvoice(allocation.invoiceId, tx);

      if (!invoice) {
        throw new NotFoundError('Invoice', allocation.invoiceId);
      }

      if (invoice.partyId !== context.partyId) {
        throw new BusinessRuleError(
          `Invoice ${invoice.invoiceNo} belongs to a different party and cannot be settled by this payment`,
        );
      }

      if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.DRAFT) {
        throw new BusinessRuleError(
          `Invoice ${invoice.invoiceNo} is ${invoice.status.toLowerCase()} and cannot receive a payment`,
        );
      }

      if (invoice.currencyCode !== context.currencyCode) {
        throw new BusinessRuleError(
          `Invoice ${invoice.invoiceNo} is in ${invoice.currencyCode} but the payment is in ${context.currencyCode}`,
        );
      }

      const amount = roundAmount(allocation.amount);
      const outstanding = roundAmount(
        toDecimal(invoice.grandTotal).minus(toDecimal(invoice.settledAmount)),
      );

      if (amount.greaterThan(outstanding)) {
        throw new BusinessRuleError(
          `Allocation of ${amount.toFixed(2)} exceeds the ${outstanding.toFixed(2)} outstanding on invoice ${invoice.invoiceNo}`,
        );
      }

      allocatedTotal = allocatedTotal.plus(amount);

      const settledAmount = roundAmount(toDecimal(invoice.settledAmount).plus(amount));

      applied.push({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amount,
        baseAmount: convertToBase(amount, context.exchangeRate),
        settledAmount,
        outstandingAfter: roundAmount(outstanding.minus(amount)),
        status: InvoiceCalculator.deriveStatus(
          toDecimal(invoice.grandTotal),
          settledAmount,
          invoice.dueDate,
        ),
      });
    }

    if (allocatedTotal.greaterThan(context.paymentAmount)) {
      throw new BusinessRuleError(
        `Allocations total ${allocatedTotal.toFixed(2)} which exceeds the payment amount of ${context.paymentAmount.toFixed(2)}`,
      );
    }

    return applied;
  }

  static totalOf(allocations: AppliedAllocation[]): Prisma.Decimal {
    return allocations.reduce<Prisma.Decimal>(
      (total, allocation) => total.plus(allocation.amount),
      new Prisma.Decimal(0),
    );
  }
}
