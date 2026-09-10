import { Prisma, type StockBalance, type StockMovement } from '@prisma/client';
import { resolveClient, type DatabaseClient, type TransactionClient } from '@/database/unit-of-work';
import type { PageRequest, PageResult } from '@/types/common';

export interface StockKey {
  productId: string;
  warehouseId: string;
}

export class InventoryRepository {
  async findBalance(key: StockKey, client?: DatabaseClient): Promise<StockBalance | null> {
    return resolveClient(client).stockBalance.findFirst({ where: key });
  }

  async ensureBalance(key: StockKey, client: TransactionClient): Promise<StockBalance> {
    const existing = await this.findBalance(key, client);

    if (existing) {
      return existing;
    }

    return client.stockBalance.create({ data: key });
  }

  async saveBalance(
    id: string,
    quantityOnHand: Prisma.Decimal,
    averageUnitCost: Prisma.Decimal,
    totalValue: Prisma.Decimal,
    client: TransactionClient,
  ): Promise<StockBalance> {
    return client.stockBalance.update({
      where: { id },
      data: { quantityOnHand, averageUnitCost, totalValue },
    });
  }

  async recordMovement(
    data: Prisma.StockMovementUncheckedCreateInput,
    client: TransactionClient,
  ): Promise<StockMovement> {
    return client.stockMovement.create({ data });
  }

  async paginateBalances(
    where: Prisma.StockBalanceWhereInput,
    page: PageRequest,
    client?: DatabaseClient,
  ): Promise<PageResult<StockBalance>> {
    const db = resolveClient(client);
    const skip = (page.page - 1) * page.pageSize;

    const [total, items] = await Promise.all([
      db.stockBalance.count({ where }),
      db.stockBalance.findMany({
        where,
        include: {
          product: {
            select: { id: true, sku: true, name: true, unitOfMeasure: true, reorderLevel: true },
          },
          warehouse: { select: { id: true, code: true, name: true } },
        },
        orderBy: page.sortBy
          ? { [page.sortBy]: page.sortDirection }
          : { product: { name: 'asc' } },
        skip,
        take: page.pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

    return {
      items,
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages,
      hasNext: page.page < totalPages,
      hasPrevious: page.page > 1,
    };
  }

  async movementsForProduct(
    productId: string,
    take = 100,
    client?: DatabaseClient,
  ): Promise<StockMovement[]> {
    return resolveClient(client).stockMovement.findMany({
      where: { productId },
      orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
  }

  async totalStockValue(client?: DatabaseClient): Promise<Prisma.Decimal> {
    const result = await resolveClient(client).stockBalance.aggregate({
      _sum: { totalValue: true },
    });

    return result._sum.totalValue ?? new Prisma.Decimal(0);
  }
}

export const inventoryRepository = new InventoryRepository();
