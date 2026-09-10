import { Prisma, type Shipment, type ShipmentCharge } from '@prisma/client';
import { BaseService } from './base.service';
import { landedCostService } from './costing/landed-cost.service';
import {
  SHIPMENT_LIST_INCLUDE,
  shipmentRepository,
  type ShipmentDetail,
  type ShipmentListItem,
} from '@/repositories/shipment.repository';
import { shipmentTrackingRepository } from '@/repositories/shipment-document.repository';
import { vendorRepository } from '@/repositories/vendor.repository';
import { productRepository } from '@/repositories/product.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { convertToBase, roundAmount, toDecimal } from '@/lib/money';
import { AuditAction, SHIPMENT_STATUS_SEQUENCE, ShipmentStatus } from '@/types/enums';
import type {
  ChangeShipmentStatusInput,
  CreateShipmentInput,
  ShipmentChargeInput,
  ShipmentContainerInput,
  ShipmentItemInput,
  ShipmentQueryInput,
  TrackingEventInput,
  UpdateShipmentInput,
} from '@/schemas/shipment.schema';
import type { PageResult, RequestContext } from '@/types/common';

const TERMINAL_STATUSES: readonly string[] = [ShipmentStatus.CLOSED, ShipmentStatus.CANCELLED];

const STATUS_DATE_FIELD: Partial<Record<string, keyof Prisma.ShipmentUncheckedUpdateInput>> = {
  [ShipmentStatus.ORDERED]: 'orderDate',
  [ShipmentStatus.SHIPPED]: 'shippingDate',
  [ShipmentStatus.ARRIVED]: 'actualArrival',
  [ShipmentStatus.CUSTOM_CLEARANCE]: 'clearanceDate',
  [ShipmentStatus.RECEIVED]: 'deliveryDate',
  [ShipmentStatus.CLOSED]: 'closedAt',
};

export class ShipmentService extends BaseService {
  private readonly entityName = 'Shipment';

  async list(query: ShipmentQueryInput): Promise<PageResult<ShipmentListItem>> {
    const page = this.normalizePage(query);

    const where: Prisma.ShipmentWhereInput = {
      ...shipmentRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierVendorId ? { supplierVendorId: query.supplierVendorId } : {}),
      ...(query.carrierVendorId ? { carrierVendorId: query.carrierVendorId } : {}),
      ...(query.transportMode ? { transportMode: query.transportMode } : {}),
      ...(query.from || query.to
        ? {
            shippingDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return shipmentRepository.paginate(where, page, {
      include: SHIPMENT_LIST_INCLUDE,
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { createdAt: 'desc' },
    }) as Promise<PageResult<ShipmentListItem>>;
  }

  async getDetail(id: string): Promise<ShipmentDetail> {
    const shipment = await shipmentRepository.findDetail(id);

    if (!shipment) {
      throw new NotFoundError(this.entityName, id);
    }

    return shipment;
  }

  async create(input: CreateShipmentInput, context: RequestContext): Promise<Shipment> {
    const shipmentId = await UnitOfWork.run(async (tx) => {
      await vendorRepository.requireById(input.supplierVendorId, {}, tx);

      const shipmentNo = await documentNumberGenerator.next(SequenceKey.SHIPMENT, tx);
      const { items, ...header } = input;

      const shipment = await shipmentRepository.create(
        { ...header, shipmentNo, status: ShipmentStatus.DRAFT },
        { userId: context.user.id },
        tx,
      );

      await this.writeItems(shipment.id, items ?? [], input.exchangeRate, context, tx);

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          fromStatus: null,
          toStatus: ShipmentStatus.DRAFT,
          remarks: 'Shipment created',
          createdById: context.user.id,
        },
      });

      await landedCostService.recalculate(shipment.id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: shipment.id,
          action: AuditAction.CREATE,
          summary: `Created shipment ${shipment.shipmentNo}`,
        },
        tx,
      );

      return shipment.id;
    });

    return shipmentRepository.requireById(shipmentId);
  }

  async update(
    id: string,
    input: UpdateShipmentInput,
    context: RequestContext,
  ): Promise<Shipment> {
    return UnitOfWork.run(async (tx) => {
      const existing = await shipmentRepository.requireById(id, {}, tx);

      if (TERMINAL_STATUSES.includes(existing.status)) {
        throw new BusinessRuleError(
          `Shipment ${existing.shipmentNo} is ${existing.status.toLowerCase()} and can no longer be edited`,
        );
      }

      const { items, ...header } = input;

      const updated = await shipmentRepository.update(
        id,
        { ...header },
        { userId: context.user.id },
        tx,
      );

      if (items) {
        await this.assertItemsEditable(id, tx);
        await this.writeItems(id, items, input.exchangeRate ?? existing.exchangeRate, context, tx);
      }

      await landedCostService.recalculate(id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated shipment ${updated.shipmentNo}`,
          changes: this.diff(
            existing as unknown as Record<string, unknown>,
            header as unknown as Record<string, unknown>,
          ),
        },
        tx,
      );

      return updated;
    });
  }

  private async assertItemsEditable(shipmentId: string, tx: TransactionClient): Promise<void> {
    const posted = await tx.goodsReceipt.count({
      where: { shipmentId, deletedAt: null, status: 'POSTED' },
    });

    if (posted > 0) {
      throw new BusinessRuleError(
        'Goods have already been received against this shipment, so the item list can no longer change',
      );
    }
  }

  private async writeItems(
    shipmentId: string,
    items: ShipmentItemInput[],
    exchangeRate: number | Prisma.Decimal | undefined,
    context: RequestContext,
    tx: TransactionClient,
  ): Promise<void> {
    const rate = toDecimal(exchangeRate ?? 1);

    const rows: Prisma.ShipmentItemCreateManyInput[] = [];

    for (const [index, item] of items.entries()) {
      const product = await productRepository.requireById(item.productId, {}, tx);
      const quantity = toDecimal(item.quantityOrdered);
      const lineTotal = roundAmount(quantity.times(toDecimal(item.unitPrice)));

      rows.push({
        shipmentId,
        productId: item.productId,
        lineNumber: index + 1,
        description: item.description ?? product.name,
        quantityOrdered: quantity,
        unitPrice: toDecimal(item.unitPrice),
        currencyCode: item.currencyCode,
        exchangeRate: rate,
        lineTotal,
        baseLineTotal: convertToBase(lineTotal, rate),
        lineWeightKg: roundAmount(quantity.times(toDecimal(product.unitWeightKg))),
        lineVolumeCbm: quantity
          .times(toDecimal(product.unitVolumeCbm))
          .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP),
        createdById: context.user.id,
        updatedById: context.user.id,
      });
    }

    await shipmentRepository.replaceItems(shipmentId, rows, tx);
  }

  /**
   * The import journey only moves forward one stage at a time. Cancellation is
   * allowed until the goods have been received into stock.
   */
  async changeStatus(
    id: string,
    input: ChangeShipmentStatusInput,
    context: RequestContext,
  ): Promise<Shipment> {
    return UnitOfWork.run(async (tx) => {
      const shipment = await shipmentRepository.requireById(id, {}, tx);

      this.assertTransitionAllowed(shipment.status, input.status);

      if (input.status === ShipmentStatus.ORDERED) {
        const itemCount = await tx.shipmentItem.count({
          where: { shipmentId: id, deletedAt: null },
        });

        if (itemCount === 0) {
          throw new BusinessRuleError('Add at least one product before placing the order');
        }
      }

      const occurredAt = input.occurredAt ?? new Date();
      const dateField = STATUS_DATE_FIELD[input.status];

      const updated = await shipmentRepository.update(
        id,
        {
          status: input.status,
          ...(dateField ? { [dateField]: occurredAt } : {}),
        },
        { userId: context.user.id },
        tx,
      );

      await tx.shipmentStatusHistory.create({
        data: {
          shipmentId: id,
          fromStatus: shipment.status,
          toStatus: input.status,
          remarks: input.remarks ?? null,
          occurredAt,
          createdById: context.user.id,
        },
      });

      await tx.shipmentTrackingEvent.create({
        data: {
          shipmentId: id,
          eventCode: input.status,
          description: input.remarks ?? `Status changed to ${input.status.replace(/_/g, ' ')}`,
          occurredAt,
          source: 'SYSTEM',
          createdById: context.user.id,
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.STATUS_CHANGE,
          summary: `${shipment.shipmentNo}: ${shipment.status} to ${input.status}`,
        },
        tx,
      );

      return updated;
    });
  }

  private assertTransitionAllowed(current: string, next: string): void {
    if (current === next) {
      throw new BusinessRuleError(`Shipment is already ${next.replace(/_/g, ' ').toLowerCase()}`);
    }

    if (TERMINAL_STATUSES.includes(current)) {
      throw new BusinessRuleError(
        `A ${current.toLowerCase()} shipment cannot change status any further`,
      );
    }

    if (next === ShipmentStatus.CANCELLED) {
      if (current === ShipmentStatus.RECEIVED) {
        throw new BusinessRuleError('Goods are already in stock, so this shipment cannot be cancelled');
      }
      return;
    }

    const currentIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(current as ShipmentStatus);
    const nextIndex = SHIPMENT_STATUS_SEQUENCE.indexOf(next as ShipmentStatus);

    if (currentIndex < 0 || nextIndex < 0) {
      throw new BusinessRuleError(`${next} is not a valid shipment stage`);
    }

    if (nextIndex !== currentIndex + 1) {
      const expected = SHIPMENT_STATUS_SEQUENCE[currentIndex + 1];
      throw new BusinessRuleError(
        `Shipment must move to ${expected?.replace(/_/g, ' ').toLowerCase()} before ${next
          .replace(/_/g, ' ')
          .toLowerCase()}`,
      );
    }
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const shipment = await shipmentRepository.requireById(id, {}, tx);

      if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.CANCELLED) {
        throw new BusinessRuleError(
          'Only a draft or cancelled shipment can be archived. Cancel the shipment first.',
        );
      }

      const receipts = await tx.goodsReceipt.count({ where: { shipmentId: id, deletedAt: null } });

      if (receipts > 0) {
        throw new BusinessRuleError(
          `Shipment ${shipment.shipmentNo} has goods receipts and cannot be archived`,
        );
      }

      await shipmentRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived shipment ${shipment.shipmentNo}`,
        },
        tx,
      );
    });
  }

  async addContainer(
    shipmentId: string,
    input: ShipmentContainerInput,
    context: RequestContext,
  ): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      await shipmentRepository.requireById(shipmentId, {}, tx);

      const duplicate = await tx.shipmentContainer.count({
        where: { shipmentId, containerNo: input.containerNo.toUpperCase(), deletedAt: null },
      });

      if (duplicate > 0) {
        throw new BusinessRuleError(
          `Container ${input.containerNo.toUpperCase()} is already attached to this shipment`,
        );
      }

      await tx.shipmentContainer.create({
        data: {
          ...input,
          containerNo: input.containerNo.toUpperCase(),
          shipmentId,
          createdById: context.user.id,
          updatedById: context.user.id,
        },
      });
    });
  }

  async removeContainer(containerId: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      await tx.shipmentContainer.update({
        where: { id: containerId },
        data: { deletedAt: new Date(), deletedById: context.user.id },
      });
    });
  }

  /** Budget lines used to compare what a shipment was expected to cost. */
  async addCharge(
    shipmentId: string,
    input: ShipmentChargeInput,
    context: RequestContext,
  ): Promise<ShipmentCharge> {
    return UnitOfWork.run(async (tx) => {
      const shipment = await shipmentRepository.requireById(shipmentId, {}, tx);
      const amount = roundAmount(toDecimal(input.quantity).times(toDecimal(input.unitRate)));

      const charge = await tx.shipmentCharge.create({
        data: {
          shipmentId,
          costGroup: input.costGroup,
          description: input.description,
          quantity: toDecimal(input.quantity),
          unitRate: toDecimal(input.unitRate),
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          amount,
          baseAmount: convertToBase(amount, input.exchangeRate),
          createdById: context.user.id,
          updatedById: context.user.id,
        },
      });

      await landedCostService.recalculate(shipmentId, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: shipmentId,
          action: AuditAction.UPDATE,
          summary: `Added budget line to ${shipment.shipmentNo}`,
        },
        tx,
      );

      return charge;
    });
  }

  async removeCharge(chargeId: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const charge = await tx.shipmentCharge.update({
        where: { id: chargeId },
        data: { deletedAt: new Date(), deletedById: context.user.id },
      });

      await landedCostService.recalculate(charge.shipmentId, tx);
    });
  }

  async addTrackingEvent(
    shipmentId: string,
    input: TrackingEventInput,
    context: RequestContext,
  ): Promise<void> {
    await shipmentRepository.requireById(shipmentId);

    await shipmentTrackingRepository.create({ ...input, shipmentId }, { userId: context.user.id });
  }

  async removeTrackingEvent(eventId: string, context: RequestContext): Promise<void> {
    await shipmentTrackingRepository.softDelete(eventId, { userId: context.user.id });
  }

  /** Re-runs costing for a shipment. Every cost document calls this. */
  async recalculateActuals(shipmentId: string, tx: TransactionClient): Promise<void> {
    await landedCostService.recalculate(shipmentId, tx);
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const shipmentService = new ShipmentService();
