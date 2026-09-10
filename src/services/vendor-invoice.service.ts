import { Prisma, type VendorInvoice } from '@prisma/client';
import { BaseService } from './base.service';
import { ledgerService } from './ledger.service';
import { shipmentService } from './shipment.service';
import { InvoiceCalculator } from './billing/invoice-calculator';
import {
  VENDOR_INVOICE_INCLUDE,
  vendorInvoiceRepository,
  type VendorInvoiceDetail,
} from '@/repositories/vendor-invoice.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { purchaseOrderRepository } from '@/repositories/purchase-order.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork } from '@/database/unit-of-work';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { toDecimal } from '@/lib/money';
import {
  AuditAction,
  InvoiceStatus,
  LedgerEntryType,
  LedgerPartyType,
  LedgerReferenceType,
  PurchaseOrderStatus,
} from '@/types/enums';
import type {
  CancelDocumentInput,
  CreateVendorInvoiceInput,
  InvoiceQueryInput,
} from '@/schemas/billing.schema';
import type { PageResult, RequestContext } from '@/types/common';

/**
 * Vendor invoices are the payables side of a shipment. Creating one posts a
 * debit to the vendor statement inside the same transaction, so the ledger can
 * never drift from the invoice register.
 */
export class VendorInvoiceService extends BaseService {
  private readonly entityName = 'Vendor invoice';

  async list(query: InvoiceQueryInput): Promise<PageResult<VendorInvoice>> {
    const page = this.normalizePage(query);

    const where: Prisma.VendorInvoiceWhereInput = {
      ...vendorInvoiceRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.partyId ? { vendorId: query.partyId } : {}),
      ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
      ...(query.overdueOnly
        ? { dueDate: { lt: new Date() }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }
        : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return vendorInvoiceRepository.paginate(where, page, {
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { invoiceDate: 'desc' },
    });
  }

  async getDetail(id: string): Promise<VendorInvoiceDetail> {
    const invoice = await vendorInvoiceRepository.findDetail(id);

    if (!invoice) {
      throw new NotFoundError(this.entityName, id);
    }

    return invoice;
  }

  async create(
    input: CreateVendorInvoiceInput,
    context: RequestContext,
  ): Promise<VendorInvoiceDetail> {
    const invoiceId = await UnitOfWork.run(async (tx) => {
      const vendor = await vendorRepository.requireById(input.vendorId, {}, tx);

      if (input.purchaseOrderId) {
        const order = await purchaseOrderRepository.requireById(input.purchaseOrderId, {}, tx);

        if (order.vendorId !== vendor.id) {
          throw new BusinessRuleError(
            `Purchase order ${order.poNumber} belongs to a different vendor`,
          );
        }

        if (order.status !== PurchaseOrderStatus.APPROVED && order.status !== PurchaseOrderStatus.COMPLETED) {
          throw new BusinessRuleError(
            `Purchase order ${order.poNumber} must be approved before it can be invoiced`,
          );
        }
      }

      const document = InvoiceCalculator.calculate(input.items, input.exchangeRate);
      const invoiceNo = await documentNumberGenerator.next(
        SequenceKey.VENDOR_INVOICE,
        tx,
        input.invoiceDate,
      );

      const status = InvoiceCalculator.deriveStatus(
        document.grandTotal,
        new Prisma.Decimal(0),
        input.dueDate,
      );

      const invoice = await tx.vendorInvoice.create({
        data: {
          invoiceNo,
          vendorRefNo: input.vendorRefNo ?? null,
          vendorId: input.vendorId,
          shipmentId: input.shipmentId ?? null,
          purchaseOrderId: input.purchaseOrderId ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          status,
          subTotal: document.subTotal,
          taxTotal: document.taxTotal,
          discountTotal: document.discountTotal,
          grandTotal: document.grandTotal,
          baseGrandTotal: document.baseGrandTotal,
          paidAmount: new Prisma.Decimal(0),
          balanceAmount: document.grandTotal,
          postedAt: new Date(),
          remarks: input.remarks ?? null,
          createdById: context.user.id,
          updatedById: context.user.id,
          items: {
            create: document.lines.map((line) => ({
              ...line,
              createdById: context.user.id,
              updatedById: context.user.id,
            })),
          },
        },
      });

      await ledgerService.post(
        {
          partyType: LedgerPartyType.VENDOR,
          partyId: vendor.id,
          partyName: vendor.name,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          entryDate: input.invoiceDate,
          entryType: LedgerEntryType.INVOICE,
          referenceType: LedgerReferenceType.VENDOR_INVOICE,
          referenceId: invoice.id,
          referenceNo: invoiceNo,
          narration: `Vendor invoice ${invoiceNo}${input.vendorRefNo ? ` (ref ${input.vendorRefNo})` : ''}`,
          debit: document.grandTotal,
          shipmentId: input.shipmentId ?? null,
          actorId: context.user.id,
        },
        tx,
      );

      if (input.purchaseOrderId) {
        await tx.purchaseOrder.update({
          where: { id: input.purchaseOrderId },
          data: { status: PurchaseOrderStatus.COMPLETED, updatedById: context.user.id },
        });
      }

      if (input.shipmentId) {
        await shipmentService.recalculateActuals(input.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: invoice.id,
          action: AuditAction.POST,
          summary: `Posted vendor invoice ${invoiceNo} for ${document.grandTotal.toFixed(2)} ${input.currencyCode}`,
        },
        tx,
      );

      return invoice.id;
    });

    return this.getDetail(invoiceId);
  }

  async update(
    id: string,
    input: CreateVendorInvoiceInput,
    context: RequestContext,
  ): Promise<VendorInvoiceDetail> {
    await UnitOfWork.run(async (tx) => {
      const existing = await vendorInvoiceRepository.requireById(id, {}, tx);

      if (toDecimal(existing.paidAmount).greaterThan(0)) {
        throw new BusinessRuleError(
          `Invoice ${existing.invoiceNo} already carries payments and can no longer be edited. Cancel it instead.`,
        );
      }

      if (existing.status === InvoiceStatus.CANCELLED) {
        throw new BusinessRuleError(`Invoice ${existing.invoiceNo} is cancelled`);
      }

      const vendor = await vendorRepository.requireById(input.vendorId, {}, tx);
      const document = InvoiceCalculator.calculate(input.items, input.exchangeRate);
      const status = InvoiceCalculator.deriveStatus(
        document.grandTotal,
        new Prisma.Decimal(0),
        input.dueDate,
      );

      await vendorInvoiceRepository.replaceItems(
        id,
        document.lines.map((line) => ({
          ...line,
          vendorInvoiceId: id,
          createdById: context.user.id,
          updatedById: context.user.id,
        })),
        tx,
      );

      await tx.vendorInvoice.update({
        where: { id },
        data: {
          vendorRefNo: input.vendorRefNo ?? null,
          vendorId: input.vendorId,
          shipmentId: input.shipmentId ?? null,
          purchaseOrderId: input.purchaseOrderId ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          status,
          subTotal: document.subTotal,
          taxTotal: document.taxTotal,
          discountTotal: document.discountTotal,
          grandTotal: document.grandTotal,
          baseGrandTotal: document.baseGrandTotal,
          balanceAmount: document.grandTotal,
          remarks: input.remarks ?? null,
          updatedById: context.user.id,
        },
      });

      await ledgerService.reverse(
        LedgerReferenceType.VENDOR_INVOICE,
        id,
        `Restated invoice ${existing.invoiceNo}`,
        context.user.id,
        tx,
      );

      await ledgerService.post(
        {
          partyType: LedgerPartyType.VENDOR,
          partyId: vendor.id,
          partyName: vendor.name,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          entryDate: input.invoiceDate,
          entryType: LedgerEntryType.INVOICE,
          referenceType: LedgerReferenceType.VENDOR_INVOICE,
          referenceId: id,
          referenceNo: existing.invoiceNo,
          narration: `Vendor invoice ${existing.invoiceNo} restated`,
          debit: document.grandTotal,
          shipmentId: input.shipmentId ?? null,
          actorId: context.user.id,
        },
        tx,
      );

      if (input.shipmentId) {
        await shipmentService.recalculateActuals(input.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Restated vendor invoice ${existing.invoiceNo}`,
        },
        tx,
      );
    });

    return this.getDetail(id);
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<VendorInvoice> {
    return UnitOfWork.run(async (tx) => {
      const invoice = await vendorInvoiceRepository.requireById(id, {}, tx);

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BusinessRuleError(`Invoice ${invoice.invoiceNo} is already cancelled`);
      }

      if (toDecimal(invoice.paidAmount).greaterThan(0)) {
        throw new BusinessRuleError(
          `Invoice ${invoice.invoiceNo} has payments allocated to it. Reverse the payments first.`,
        );
      }

      await ledgerService.reverse(
        LedgerReferenceType.VENDOR_INVOICE,
        id,
        `Cancelled invoice ${invoice.invoiceNo}: ${input.reason}`,
        context.user.id,
        tx,
      );

      const cancelled = await tx.vendorInvoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason,
          balanceAmount: new Prisma.Decimal(0),
          updatedById: context.user.id,
        },
      });

      if (invoice.shipmentId) {
        await shipmentService.recalculateActuals(invoice.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.CANCEL,
          summary: `Cancelled vendor invoice ${invoice.invoiceNo}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  async outstandingForVendor(vendorId: string) {
    const invoices = await vendorInvoiceRepository.findOutstandingForVendor(vendorId);

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currencyCode: invoice.currencyCode,
      grandTotal: invoice.grandTotal.toFixed(2),
      paidAmount: invoice.paidAmount.toFixed(2),
      balanceAmount: invoice.balanceAmount.toFixed(2),
      status: invoice.status,
    }));
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }

  get detailInclude() {
    return VENDOR_INVOICE_INCLUDE;
  }
}

export const vendorInvoiceService = new VendorInvoiceService();
