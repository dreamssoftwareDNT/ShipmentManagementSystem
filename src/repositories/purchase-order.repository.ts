import type { Prisma, PurchaseOrder } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const PURCHASE_ORDER_INCLUDE = {
  vendor: { select: { id: true, code: true, name: true, currencyCode: true } },
  shipment: { select: { id: true, shipmentNo: true } },
  items: { where: { deletedAt: null }, orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.PurchaseOrderInclude;

export type PurchaseOrderDetail = Prisma.PurchaseOrderGetPayload<{
  include: typeof PURCHASE_ORDER_INCLUDE;
}>;

export class PurchaseOrderRepository extends BaseRepository<PurchaseOrder> {
  protected readonly entityName = 'Purchase order';

  protected delegate(client: DatabaseClient): ModelDelegate<PurchaseOrder> {
    return client.purchaseOrder as unknown as ModelDelegate<PurchaseOrder>;
  }

  buildSearchFilter(search?: string): Prisma.PurchaseOrderWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { poNumber: { contains: search } },
        { vendor: { name: { contains: search } } },
        { shipment: { shipmentNo: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient): Promise<PurchaseOrderDetail | null> {
    return resolveClient(client).purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: PURCHASE_ORDER_INCLUDE,
    });
  }

  async replaceItems(
    purchaseOrderId: string,
    items: Prisma.PurchaseOrderItemCreateManyInput[],
    client: DatabaseClient,
  ): Promise<void> {
    await client.purchaseOrderItem.deleteMany({ where: { purchaseOrderId } });

    if (items.length > 0) {
      await client.purchaseOrderItem.createMany({ data: items });
    }
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
