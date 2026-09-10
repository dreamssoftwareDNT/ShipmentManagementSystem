import { Prisma, type StockBalance } from '@prisma/client';
import { BaseService } from './base.service';
import { inventoryRepository } from '@/repositories/inventory.repository';
import { warehouseRepository } from '@/repositories/warehouse.repository';
import { prisma } from '@/database/prisma';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { roundAmount, toDecimal } from '@/lib/money';
import { AuditAction, StockMovementType } from '@/types/enums';
import type { InventoryQueryInput, WarehouseInput } from '@/schemas/goods-receipt.schema';
import type { PageResult, RequestContext, SelectOption } from '@/types/common';

const ZERO = new Prisma.Decimal(0);

export interface StockMovementRequest {
  productId: string;
  warehouseId: string;
  movementType: string;
  movementDate: Date;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  referenceType: string;
  referenceId: string;
  referenceNo: string;
  shipmentId?: string | null;
  narration?: string;
  isReversal?: boolean;
  actorId: string;
}

export interface InventoryValuation {
  totalValue: string;
  distinctProducts: number;
  belowReorderLevel: number;
}

/**
 * Stock is valued at weighted average cost. A receipt blends its landed unit
 * cost into the running average; a reversal removes the same value it added, so
 * cancelling a receipt returns the balance to exactly where it was.
 */
export class InventoryService extends BaseService {
  async applyMovement(
    request: StockMovementRequest,
    tx: TransactionClient,
  ): Promise<StockBalance> {
    const balance = await inventoryRepository.ensureBalance(
      { productId: request.productId, warehouseId: request.warehouseId },
      tx,
    );

    const currentQuantity = toDecimal(balance.quantityOnHand);
    const currentValue = toDecimal(balance.totalValue);
    const movementQuantity = toDecimal(request.quantity);
    const movementValue = roundAmount(movementQuantity.times(toDecimal(request.unitCost)));

    const nextQuantity = currentQuantity.plus(movementQuantity);

    if (nextQuantity.lessThan(0)) {
      throw new BusinessRuleError(
        'This movement would take stock below zero, which is not allowed',
      );
    }

    const nextValue = roundAmount(currentValue.plus(movementValue));
    const nextAverage = nextQuantity.greaterThan(0)
      ? nextValue.dividedBy(nextQuantity).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
      : ZERO;

    const updated = await inventoryRepository.saveBalance(
      balance.id,
      nextQuantity,
      nextAverage,
      nextQuantity.greaterThan(0) ? nextValue : ZERO,
      tx,
    );

    await inventoryRepository.recordMovement(
      {
        productId: request.productId,
        warehouseId: request.warehouseId,
        movementType: request.movementType,
        movementDate: request.movementDate,
        quantity: movementQuantity,
        unitCost: toDecimal(request.unitCost),
        totalCost: movementValue,
        balanceAfter: nextQuantity,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        referenceNo: request.referenceNo,
        shipmentId: request.shipmentId ?? null,
        narration: request.narration ?? null,
        isReversal: request.isReversal ?? false,
        createdById: request.actorId,
      },
      tx,
    );

    return updated;
  }

  async listBalances(query: InventoryQueryInput): Promise<PageResult<StockBalance>> {
    const page = this.normalizePage(query);

    const where: Prisma.StockBalanceWhereInput = {
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.categoryId ? { product: { categoryId: query.categoryId } } : {}),
      ...(query.inStockOnly ? { quantityOnHand: { gt: 0 } } : {}),
      ...(page.search
        ? {
            product: {
              OR: [
                { sku: { contains: page.search } },
                { name: { contains: page.search } },
                { barcode: { contains: page.search } },
              ],
            },
          }
        : {}),
    };

    return inventoryRepository.paginateBalances(where, page);
  }

  async valuation(): Promise<InventoryValuation> {
    const [totalValue, distinctProducts, balances] = await Promise.all([
      inventoryRepository.totalStockValue(),
      prisma.stockBalance.count({ where: { quantityOnHand: { gt: 0 } } }),
      prisma.stockBalance.findMany({
        where: { quantityOnHand: { gt: 0 } },
        select: { quantityOnHand: true, product: { select: { reorderLevel: true } } },
      }),
    ]);

    const belowReorderLevel = balances.filter(
      (balance) =>
        toDecimal(balance.product.reorderLevel).greaterThan(0) &&
        toDecimal(balance.quantityOnHand).lessThanOrEqualTo(
          toDecimal(balance.product.reorderLevel),
        ),
    ).length;

    return {
      totalValue: totalValue.toFixed(2),
      distinctProducts,
      belowReorderLevel,
    };
  }

  async movementsForProduct(productId: string) {
    return inventoryRepository.movementsForProduct(productId);
  }

  async warehouseOptions(): Promise<SelectOption[]> {
    const warehouses = await warehouseRepository.listActive();

    return warehouses.map((warehouse) => ({
      value: warehouse.id,
      label: warehouse.name,
      hint: warehouse.code,
    }));
  }

  async listWarehouses() {
    return warehouseRepository.findAll({}, { orderBy: { name: 'asc' } });
  }

  async createWarehouse(input: WarehouseInput, context: RequestContext) {
    return UnitOfWork.run(async (tx) => {
      this.assertUnique(
        await warehouseRepository.isCodeTaken(input.code, undefined, tx),
        'code',
        `Warehouse code ${input.code} is already in use`,
      );

      const warehouse = await warehouseRepository.create(
        { ...input },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: 'Warehouse',
          entityId: warehouse.id,
          action: AuditAction.CREATE,
          summary: `Created warehouse ${warehouse.name}`,
        },
        tx,
      );

      return warehouse;
    });
  }

  async removeWarehouse(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const warehouse = await warehouseRepository.requireById(id, {}, tx);

      const stocked = await tx.stockBalance.findFirst({
        where: { warehouseId: id, quantityOnHand: { gt: 0 } },
      });

      if (stocked) {
        throw new BusinessRuleError(
          `${warehouse.name} still holds stock and cannot be archived`,
        );
      }

      await warehouseRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: 'Warehouse',
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Archived warehouse ${warehouse.name}`,
        },
        tx,
      );
    });
  }

  get movementTypes(): string[] {
    return Object.values(StockMovementType);
  }
}

export const inventoryService = new InventoryService();
