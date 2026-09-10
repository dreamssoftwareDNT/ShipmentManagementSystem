import { Prisma, type PurchaseOrder } from '@prisma/client';
import { BaseService } from './base.service';
import { InvoiceCalculator } from './billing/invoice-calculator';
import {
  purchaseOrderRepository,
  type PurchaseOrderDetail,
} from '@/repositories/purchase-order.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { shipmentRepository } from '@/repositories/shipment.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork } from '@/database/unit-of-work';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { toDecimal } from '@/lib/money';
import { AuditAction, PurchaseOrderStatus } from '@/types/enums';
import type {
  CancelDocumentInput,
  CreatePurchaseOrderInput,
  PurchaseOrderQueryInput,
} from '@/schemas/billing.schema';
import type { PageResult, RequestContext } from '@/types/common';

const EDITABLE_STATUSES: readonly string[] = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.PENDING_APPROVAL,
];

/**
 * Procurement of carrier and handling services. A purchase order must be
 * approved before a vendor invoice can be raised against it, which is what
 * gives the finance team a control point on committed spend.
 */
export class PurchaseOrderService extends BaseService {
  private readonly entityName = 'Purchase order';

  async list(query: PurchaseOrderQueryInput): Promise<PageResult<PurchaseOrder>> {
    const page = this.normalizePage(query);

    const where: Prisma.PurchaseOrderWhereInput = {
      ...purchaseOrderRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
      ...(query.from || query.to
        ? {
            orderDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return purchaseOrderRepository.paginate(where, page, {
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { orderDate: 'desc' },
    });
  }

  async getDetail(id: string): Promise<PurchaseOrderDetail> {
    const order = await purchaseOrderRepository.findDetail(id);

    if (!order) {
      throw new NotFoundError(this.entityName, id);
    }

    return order;
  }

  async create(
    input: CreatePurchaseOrderInput,
    context: RequestContext,
  ): Promise<PurchaseOrderDetail> {
    const orderId = await UnitOfWork.run(async (tx) => {
      const vendor = await vendorRepository.requireById(input.vendorId, {}, tx);

      if (input.shipmentId) {
        await shipmentRepository.requireById(input.shipmentId, {}, tx);
      }

      const document = InvoiceCalculator.calculate(input.items, input.exchangeRate);
      const poNumber = await documentNumberGenerator.next(
        SequenceKey.PURCHASE_ORDER,
        tx,
        input.orderDate,
      );

      const order = await tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: vendor.id,
          shipmentId: input.shipmentId ?? null,
          orderDate: input.orderDate,
          expectedDate: input.expectedDate ?? null,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          status: PurchaseOrderStatus.DRAFT,
          subTotal: document.subTotal,
          taxTotal: document.taxTotal,
          discountTotal: document.discountTotal,
          grandTotal: document.grandTotal,
          baseGrandTotal: document.baseGrandTotal,
          terms: input.terms ?? null,
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

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: order.id,
          action: AuditAction.CREATE,
          summary: `Created purchase order ${poNumber} for ${vendor.name}`,
        },
        tx,
      );

      return order.id;
    });

    return this.getDetail(orderId);
  }

  async update(
    id: string,
    input: CreatePurchaseOrderInput,
    context: RequestContext,
  ): Promise<PurchaseOrderDetail> {
    await UnitOfWork.run(async (tx) => {
      const existing = await purchaseOrderRepository.requireById(id, {}, tx);

      if (!EDITABLE_STATUSES.includes(existing.status)) {
        throw new BusinessRuleError(
          `Purchase order ${existing.poNumber} is ${existing.status.replace(/_/g, ' ').toLowerCase()} and can no longer be edited`,
        );
      }

      const document = InvoiceCalculator.calculate(input.items, input.exchangeRate);

      await purchaseOrderRepository.replaceItems(
        id,
        document.lines.map((line) => ({
          ...line,
          purchaseOrderId: id,
          createdById: context.user.id,
          updatedById: context.user.id,
        })),
        tx,
      );

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: input.vendorId,
          shipmentId: input.shipmentId ?? null,
          orderDate: input.orderDate,
          expectedDate: input.expectedDate ?? null,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          subTotal: document.subTotal,
          taxTotal: document.taxTotal,
          discountTotal: document.discountTotal,
          grandTotal: document.grandTotal,
          baseGrandTotal: document.baseGrandTotal,
          terms: input.terms ?? null,
          remarks: input.remarks ?? null,
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated purchase order ${existing.poNumber}`,
        },
        tx,
      );
    });

    return this.getDetail(id);
  }

  async submitForApproval(id: string, context: RequestContext): Promise<PurchaseOrder> {
    return this.transition(id, PurchaseOrderStatus.PENDING_APPROVAL, context, (order) => {
      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new BusinessRuleError(
          `Only a draft purchase order can be submitted for approval`,
        );
      }
    });
  }

  async approve(id: string, context: RequestContext): Promise<PurchaseOrder> {
    return UnitOfWork.run(async (tx) => {
      const order = await purchaseOrderRepository.requireById(id, {}, tx);

      if (order.status !== PurchaseOrderStatus.PENDING_APPROVAL && order.status !== PurchaseOrderStatus.DRAFT) {
        throw new BusinessRuleError(
          `Purchase order ${order.poNumber} is ${order.status.replace(/_/g, ' ').toLowerCase()} and cannot be approved`,
        );
      }

      if (order.createdById === context.user.id && !context.user.roles.includes('ADMIN')) {
        throw new BusinessRuleError(
          'A purchase order must be approved by someone other than its author',
        );
      }

      const approved = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.APPROVED,
          approvedById: context.user.id,
          approvedAt: new Date(),
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.APPROVE,
          summary: `Approved purchase order ${order.poNumber}`,
        },
        tx,
      );

      return approved;
    });
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<PurchaseOrder> {
    return UnitOfWork.run(async (tx) => {
      const order = await purchaseOrderRepository.requireById(id, {}, tx);

      if (order.status === PurchaseOrderStatus.COMPLETED) {
        throw new BusinessRuleError(
          `Purchase order ${order.poNumber} has been invoiced and cannot be cancelled`,
        );
      }

      if (order.status === PurchaseOrderStatus.CANCELLED) {
        throw new BusinessRuleError(`Purchase order ${order.poNumber} is already cancelled`);
      }

      const cancelled = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason,
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.CANCEL,
          summary: `Cancelled purchase order ${order.poNumber}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  private async transition(
    id: string,
    nextStatus: PurchaseOrderStatus,
    context: RequestContext,
    guard: (order: PurchaseOrder) => void,
  ): Promise<PurchaseOrder> {
    return UnitOfWork.run(async (tx) => {
      const order = await purchaseOrderRepository.requireById(id, {}, tx);
      guard(order);

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus, updatedById: context.user.id },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.STATUS_CHANGE,
          summary: `${order.poNumber}: ${order.status} to ${nextStatus}`,
        },
        tx,
      );

      return updated;
    });
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
