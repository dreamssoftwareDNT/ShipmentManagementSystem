import { Prisma, type GoodsReceipt } from '@prisma/client';
import { BaseService } from './base.service';
import { landedCostService } from './costing/landed-cost.service';
import { inventoryService } from './inventory.service';
import {
  goodsReceiptRepository,
  type GoodsReceiptDetail,
} from '@/repositories/goods-receipt.repository';
import { shipmentRepository } from '@/repositories/shipment.repository';
import { warehouseRepository } from '@/repositories/warehouse.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { roundAmount, toDecimal } from '@/lib/money';
import {
  AuditAction,
  GoodsReceiptStatus,
  ShipmentStatus,
  StockMovementType,
} from '@/types/enums';
import type {
  CancelDocumentInput,
  CreateGoodsReceiptInput,
  GoodsReceiptQueryInput,
} from '@/schemas/goods-receipt.schema';
import type { PageResult, RequestContext } from '@/types/common';

const ZERO = new Prisma.Decimal(0);

/**
 * Receiving is where costing meets inventory. A draft receipt can be corrected
 * freely; posting it writes stock movements at the shipment line's landed unit
 * cost and is only undone through a cancellation that reverses those movements.
 */
export class GoodsReceiptService extends BaseService {
  private readonly entityName = 'Goods receipt';

  async list(query: GoodsReceiptQueryInput): Promise<PageResult<GoodsReceipt>> {
    const page = this.normalizePage(query);

    const where: Prisma.GoodsReceiptWhereInput = {
      ...goodsReceiptRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.from || query.to
        ? {
            receiptDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return goodsReceiptRepository.paginate(where, page, {
      include: {
        shipment: { select: { id: true, shipmentNo: true } },
        warehouse: { select: { id: true, code: true, name: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { receiptDate: 'desc' },
    });
  }

  async getDetail(id: string): Promise<GoodsReceiptDetail> {
    const receipt = await goodsReceiptRepository.findDetail(id);

    if (!receipt) {
      throw new NotFoundError(this.entityName, id);
    }

    return receipt;
  }

  async create(
    input: CreateGoodsReceiptInput,
    context: RequestContext,
  ): Promise<GoodsReceiptDetail> {
    const receiptId = await UnitOfWork.run(async (tx) => {
      const shipment = await shipmentRepository.requireById(input.shipmentId, {}, tx);
      await warehouseRepository.requireById(input.warehouseId, {}, tx);

      if (shipment.status === ShipmentStatus.DRAFT) {
        throw new BusinessRuleError(
          'Goods cannot be received against a draft shipment. Place the order first.',
        );
      }

      if (shipment.status === ShipmentStatus.CANCELLED) {
        throw new BusinessRuleError('This shipment was cancelled');
      }

      // costing may have moved since the lines were entered
      await landedCostService.recalculate(input.shipmentId, tx);

      const receiptNo = await documentNumberGenerator.next(
        SequenceKey.GOODS_RECEIPT,
        tx,
        input.receiptDate,
      );

      const lines = await this.buildLines(input, tx, context);

      const totalQuantity = lines.reduce<Prisma.Decimal>(
        (total, line) => total.plus(line.quantityReceived),
        ZERO,
      );
      const totalCost = lines.reduce<Prisma.Decimal>(
        (total, line) => total.plus(line.totalCost),
        ZERO,
      );

      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNo,
          shipmentId: input.shipmentId,
          warehouseId: input.warehouseId,
          receiptDate: input.receiptDate,
          status: GoodsReceiptStatus.DRAFT,
          totalQuantity,
          totalCost: roundAmount(totalCost),
          remarks: input.remarks ?? null,
          createdById: context.user.id,
          updatedById: context.user.id,
          items: { create: lines },
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: receipt.id,
          action: AuditAction.CREATE,
          summary: `Drafted receipt ${receiptNo} for ${shipment.shipmentNo}`,
        },
        tx,
      );

      return receipt.id;
    });

    return this.getDetail(receiptId);
  }

  private async buildLines(
    input: CreateGoodsReceiptInput,
    tx: TransactionClient,
    context: RequestContext,
  ) {
    const lines = [];

    for (const [index, item] of input.items.entries()) {
      const shipmentItem = await tx.shipmentItem.findFirst({
        where: { id: item.shipmentItemId, shipmentId: input.shipmentId, deletedAt: null },
      });

      if (!shipmentItem) {
        throw new NotFoundError('Shipment line', item.shipmentItemId);
      }

      const received = toDecimal(item.quantityReceived);
      const damaged = toDecimal(item.quantityDamaged);

      if (received.lessThanOrEqualTo(0)) {
        throw new BusinessRuleError('Received quantity must be greater than zero');
      }

      const alreadyReceived = await this.postedQuantityFor(item.shipmentItemId, tx);
      const outstanding = toDecimal(shipmentItem.quantityOrdered).minus(alreadyReceived);

      if (received.greaterThan(outstanding)) {
        throw new BusinessRuleError(
          `Line ${shipmentItem.lineNumber}: receiving ${received.toFixed(3)} exceeds the ${outstanding.toFixed(3)} still outstanding`,
        );
      }

      const unitLandedCost = toDecimal(shipmentItem.unitLandedCost);

      lines.push({
        shipmentItemId: shipmentItem.id,
        productId: shipmentItem.productId,
        lineNumber: index + 1,
        quantityReceived: received,
        quantityDamaged: damaged,
        unitLandedCost,
        totalCost: roundAmount(received.times(unitLandedCost)),
        batchNo: item.batchNo ?? null,
        remarks: item.remarks ?? null,
        createdById: context.user.id,
        updatedById: context.user.id,
      });
    }

    return lines;
  }

  private async postedQuantityFor(
    shipmentItemId: string,
    tx: TransactionClient,
  ): Promise<Prisma.Decimal> {
    const result = await tx.goodsReceiptItem.aggregate({
      where: {
        shipmentItemId,
        deletedAt: null,
        goodsReceipt: { status: GoodsReceiptStatus.POSTED, deletedAt: null },
      },
      _sum: { quantityReceived: true },
    });

    return result._sum.quantityReceived ?? ZERO;
  }

  /**
   * Posting moves stock. It refreshes each line's cost from the current landed
   * cost first, so a receipt drafted before the last invoice arrived still
   * books at the right value.
   */
  async post(id: string, context: RequestContext): Promise<GoodsReceipt> {
    return UnitOfWork.run(async (tx) => {
      const receipt = await goodsReceiptRepository.requireById(id, {}, tx);

      if (receipt.status !== GoodsReceiptStatus.DRAFT) {
        throw new BusinessRuleError(`Receipt ${receipt.receiptNo} has already been posted`);
      }

      await landedCostService.recalculate(receipt.shipmentId, tx);

      const items = await tx.goodsReceiptItem.findMany({
        where: { goodsReceiptId: id, deletedAt: null },
        orderBy: { lineNumber: 'asc' },
        include: { shipmentItem: { select: { id: true, unitLandedCost: true } } },
      });

      let totalCost = ZERO;

      for (const item of items) {
        const unitLandedCost = toDecimal(item.shipmentItem.unitLandedCost);
        const lineCost = roundAmount(toDecimal(item.quantityReceived).times(unitLandedCost));
        totalCost = totalCost.plus(lineCost);

        await tx.goodsReceiptItem.update({
          where: { id: item.id },
          data: { unitLandedCost, totalCost: lineCost },
        });

        await inventoryService.applyMovement(
          {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            movementType: StockMovementType.RECEIPT,
            movementDate: receipt.receiptDate,
            quantity: toDecimal(item.quantityReceived),
            unitCost: unitLandedCost,
            referenceType: 'GOODS_RECEIPT',
            referenceId: receipt.id,
            referenceNo: receipt.receiptNo,
            shipmentId: receipt.shipmentId,
            narration: `Received against ${receipt.receiptNo}`,
            actorId: context.user.id,
          },
          tx,
        );

        await tx.shipmentItem.update({
          where: { id: item.shipmentItemId },
          data: {
            quantityReceived: { increment: toDecimal(item.quantityReceived) },
            quantityDamaged: { increment: toDecimal(item.quantityDamaged) },
          },
        });
      }

      const posted = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: GoodsReceiptStatus.POSTED,
          postedAt: new Date(),
          totalCost: roundAmount(totalCost),
          updatedById: context.user.id,
        },
      });

      await this.advanceShipmentIfComplete(receipt.shipmentId, context, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.POST,
          summary: `Posted receipt ${receipt.receiptNo} valued at ${roundAmount(totalCost).toFixed(2)}`,
        },
        tx,
      );

      return posted;
    });
  }

  private async advanceShipmentIfComplete(
    shipmentId: string,
    context: RequestContext,
    tx: TransactionClient,
  ): Promise<void> {
    const shipment = await tx.shipment.findFirstOrThrow({ where: { id: shipmentId } });

    if (shipment.status === ShipmentStatus.RECEIVED || shipment.status === ShipmentStatus.CLOSED) {
      return;
    }

    const outstanding = await tx.shipmentItem.findFirst({
      where: {
        shipmentId,
        deletedAt: null,
        quantityReceived: { lt: tx.shipmentItem.fields.quantityOrdered },
      },
    });

    if (outstanding) {
      return;
    }

    await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: ShipmentStatus.RECEIVED, deliveryDate: new Date() },
    });

    await tx.shipmentStatusHistory.create({
      data: {
        shipmentId,
        fromStatus: shipment.status,
        toStatus: ShipmentStatus.RECEIVED,
        remarks: 'All ordered quantities have been received into stock',
        createdById: context.user.id,
      },
    });
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<GoodsReceipt> {
    return UnitOfWork.run(async (tx) => {
      const receipt = await goodsReceiptRepository.requireById(id, {}, tx);

      if (receipt.status === GoodsReceiptStatus.CANCELLED) {
        throw new BusinessRuleError(`Receipt ${receipt.receiptNo} is already cancelled`);
      }

      if (receipt.status === GoodsReceiptStatus.POSTED) {
        const items = await tx.goodsReceiptItem.findMany({
          where: { goodsReceiptId: id, deletedAt: null },
        });

        for (const item of items) {
          await inventoryService.applyMovement(
            {
              productId: item.productId,
              warehouseId: receipt.warehouseId,
              movementType: StockMovementType.RETURN,
              movementDate: new Date(),
              quantity: toDecimal(item.quantityReceived).negated(),
              unitCost: toDecimal(item.unitLandedCost),
              referenceType: 'GOODS_RECEIPT',
              referenceId: receipt.id,
              referenceNo: receipt.receiptNo,
              shipmentId: receipt.shipmentId,
              narration: `Reversal of ${receipt.receiptNo}: ${input.reason}`,
              isReversal: true,
              actorId: context.user.id,
            },
            tx,
          );

          await tx.shipmentItem.update({
            where: { id: item.shipmentItemId },
            data: {
              quantityReceived: { decrement: toDecimal(item.quantityReceived) },
              quantityDamaged: { decrement: toDecimal(item.quantityDamaged) },
            },
          });
        }
      }

      const cancelled = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: GoodsReceiptStatus.CANCELLED,
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
          summary: `Cancelled receipt ${receipt.receiptNo}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const receipt = await goodsReceiptRepository.requireById(id, {}, tx);

      if (receipt.status === GoodsReceiptStatus.POSTED) {
        throw new BusinessRuleError(
          `Receipt ${receipt.receiptNo} is posted. Cancel it instead so the stock is reversed.`,
        );
      }

      await goodsReceiptRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived draft receipt ${receipt.receiptNo}`,
        },
        tx,
      );
    });
  }

  /** Lines still awaiting receipt on a shipment, used to prefill the form. */
  async pendingLines(shipmentId: string) {
    const items = await shipmentRepository.findDetail(shipmentId);

    if (!items) {
      throw new NotFoundError('Shipment', shipmentId);
    }

    return items.items
      .map((item) => {
        const outstanding = toDecimal(item.quantityOrdered).minus(toDecimal(item.quantityReceived));

        return {
          shipmentItemId: item.id,
          lineNumber: item.lineNumber,
          productId: item.productId,
          sku: item.product.sku,
          productName: item.product.name,
          unitOfMeasure: item.product.unitOfMeasure,
          quantityOrdered: item.quantityOrdered.toFixed(3),
          quantityReceived: item.quantityReceived.toFixed(3),
          outstanding: outstanding.toFixed(3),
          unitLandedCost: item.unitLandedCost.toFixed(4),
        };
      })
      .filter((line) => Number.parseFloat(line.outstanding) > 0);
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const goodsReceiptService = new GoodsReceiptService();
