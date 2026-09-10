import { Prisma, type VendorPayment } from '@prisma/client';
import { BaseService } from './base.service';
import { ledgerService } from './ledger.service';
import { PaymentAllocator, type AllocatableInvoice } from './billing/payment-allocator';
import { InvoiceCalculator } from './billing/invoice-calculator';
import { vendorPaymentRepository } from '@/repositories/vendor-invoice.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { convertToBase, roundAmount, toDecimal } from '@/lib/money';
import {
  AuditAction,
  LedgerEntryType,
  LedgerPartyType,
  LedgerReferenceType,
  PaymentStatus,
} from '@/types/enums';
import type { CancelDocumentInput, CreatePaymentInput, PaymentQueryInput } from '@/schemas/billing.schema';
import type { PageResult, RequestContext } from '@/types/common';

export class VendorPaymentService extends BaseService {
  private readonly entityName = 'Vendor payment';

  async list(query: PaymentQueryInput): Promise<PageResult<VendorPayment>> {
    const page = this.normalizePage(query);

    const where: Prisma.VendorPaymentWhereInput = {
      ...vendorPaymentRepository.buildSearchFilter(page.search),
      ...(query.partyId ? { vendorId: query.partyId } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.from || query.to
        ? {
            paymentDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return vendorPaymentRepository.paginate(where, page, {
      include: { vendor: { select: { id: true, code: true, name: true } } },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { paymentDate: 'desc' },
    });
  }

  async getDetail(id: string) {
    const payment = await vendorPaymentRepository.findDetail(id);

    if (!payment) {
      await vendorPaymentRepository.requireById(id);
    }

    return payment;
  }

  async create(input: CreatePaymentInput, context: RequestContext): Promise<VendorPayment> {
    return UnitOfWork.run(async (tx) => {
      const vendor = await vendorRepository.requireById(input.partyId, {}, tx);
      const amount = roundAmount(input.amount);

      const allocations = await PaymentAllocator.apply(
        {
          partyId: vendor.id,
          paymentAmount: amount,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          allocations: input.allocations,
          loadInvoice: (invoiceId, client) => this.loadInvoice(invoiceId, client),
        },
        tx,
      );

      const allocatedAmount = PaymentAllocator.totalOf(allocations);
      const paymentNo = await documentNumberGenerator.next(
        SequenceKey.VENDOR_PAYMENT,
        tx,
        input.paymentDate,
      );

      const payment = await tx.vendorPayment.create({
        data: {
          paymentNo,
          vendorId: vendor.id,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          amount,
          baseAmount: convertToBase(amount, input.exchangeRate),
          allocatedAmount,
          status: PaymentStatus.POSTED,
          bankAccount: input.bankAccount ?? null,
          referenceNo: input.referenceNo ?? null,
          chequeNo: input.chequeNo ?? null,
          chequeDate: input.chequeDate ?? null,
          remarks: input.remarks ?? null,
          createdById: context.user.id,
          updatedById: context.user.id,
        },
      });

      for (const allocation of allocations) {
        await tx.vendorPaymentAllocation.create({
          data: {
            vendorPaymentId: payment.id,
            vendorInvoiceId: allocation.invoiceId,
            amount: allocation.amount,
            baseAmount: allocation.baseAmount,
            createdById: context.user.id,
            updatedById: context.user.id,
          },
        });

        await tx.vendorInvoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: allocation.settledAmount,
            balanceAmount: roundAmount(
              toDecimal(allocation.outstandingAfter),
            ),
            status: allocation.status,
            updatedById: context.user.id,
          },
        });
      }

      await ledgerService.post(
        {
          partyType: LedgerPartyType.VENDOR,
          partyId: vendor.id,
          partyName: vendor.name,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          entryDate: input.paymentDate,
          entryType: LedgerEntryType.PAYMENT,
          referenceType: LedgerReferenceType.VENDOR_PAYMENT,
          referenceId: payment.id,
          referenceNo: paymentNo,
          narration: this.buildNarration(paymentNo, input, allocations.map((a) => a.invoiceNo)),
          credit: amount,
          actorId: context.user.id,
        },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: payment.id,
          action: AuditAction.POST,
          summary: `Paid ${amount.toFixed(2)} ${input.currencyCode} to ${vendor.name} (${paymentNo})`,
        },
        tx,
      );

      return payment;
    });
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<VendorPayment> {
    return UnitOfWork.run(async (tx) => {
      const payment = await vendorPaymentRepository.requireById(id, {}, tx);

      if (payment.status === PaymentStatus.CANCELLED) {
        throw new BusinessRuleError(`Payment ${payment.paymentNo} is already cancelled`);
      }

      const allocations = await tx.vendorPaymentAllocation.findMany({
        where: { vendorPaymentId: id, deletedAt: null },
      });

      for (const allocation of allocations) {
        const invoice = await tx.vendorInvoice.findUniqueOrThrow({
          where: { id: allocation.vendorInvoiceId },
        });

        const paidAmount = roundAmount(
          toDecimal(invoice.paidAmount).minus(toDecimal(allocation.amount)),
        );

        await tx.vendorInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount,
            balanceAmount: roundAmount(toDecimal(invoice.grandTotal).minus(paidAmount)),
            status: InvoiceCalculator.deriveStatus(
              toDecimal(invoice.grandTotal),
              paidAmount,
              invoice.dueDate,
            ),
            updatedById: context.user.id,
          },
        });

        await tx.vendorPaymentAllocation.update({
          where: { id: allocation.id },
          data: { deletedAt: new Date(), deletedById: context.user.id },
        });
      }

      await ledgerService.reverse(
        LedgerReferenceType.VENDOR_PAYMENT,
        id,
        `Cancelled payment ${payment.paymentNo}: ${input.reason}`,
        context.user.id,
        tx,
      );

      const cancelled = await tx.vendorPayment.update({
        where: { id },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason,
          allocatedAmount: new Prisma.Decimal(0),
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.CANCEL,
          summary: `Cancelled vendor payment ${payment.paymentNo}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  private async loadInvoice(
    invoiceId: string,
    tx: TransactionClient,
  ): Promise<AllocatableInvoice | null> {
    const invoice = await tx.vendorInvoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });

    if (!invoice) {
      return null;
    }

    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      currencyCode: invoice.currencyCode,
      grandTotal: invoice.grandTotal,
      settledAmount: invoice.paidAmount,
      dueDate: invoice.dueDate,
      status: invoice.status,
      partyId: invoice.vendorId,
    };
  }

  private buildNarration(
    paymentNo: string,
    input: CreatePaymentInput,
    invoiceNumbers: string[],
  ): string {
    const method = input.paymentMethod.replace(/_/g, ' ').toLowerCase();
    const reference = input.chequeNo ?? input.referenceNo;
    const settled = invoiceNumbers.length > 0 ? ` against ${invoiceNumbers.join(', ')}` : '';

    return `Payment ${paymentNo} by ${method}${reference ? ` (${reference})` : ''}${settled}`;
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const vendorPaymentService = new VendorPaymentService();
