import type { GoodsReceipt, Prisma } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const GOODS_RECEIPT_INCLUDE = {
  shipment: {
    select: { id: true, shipmentNo: true, supplierVendorId: true, baseCurrency: true },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  items: {
    where: { deletedAt: null },
    orderBy: { lineNumber: 'asc' },
    include: {
      product: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
      shipmentItem: { select: { id: true, lineNumber: true, quantityOrdered: true } },
    },
  },
} satisfies Prisma.GoodsReceiptInclude;

export type GoodsReceiptDetail = Prisma.GoodsReceiptGetPayload<{
  include: typeof GOODS_RECEIPT_INCLUDE;
}>;

export class GoodsReceiptRepository extends BaseRepository<GoodsReceipt> {
  protected readonly entityName = 'Goods receipt';

  protected delegate(client: DatabaseClient): ModelDelegate<GoodsReceipt> {
    return client.goodsReceipt as unknown as ModelDelegate<GoodsReceipt>;
  }

  buildSearchFilter(search?: string): Prisma.GoodsReceiptWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { receiptNo: { contains: search } },
        { shipment: { shipmentNo: { contains: search } } },
        { warehouse: { name: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient): Promise<GoodsReceiptDetail | null> {
    return resolveClient(client).goodsReceipt.findFirst({
      where: { id, deletedAt: null },
      include: GOODS_RECEIPT_INCLUDE,
    });
  }

  async listForShipment(shipmentId: string, client?: DatabaseClient): Promise<GoodsReceipt[]> {
    return this.findAll({ shipmentId }, { orderBy: { receiptDate: 'desc' } }, client);
  }
}

export const goodsReceiptRepository = new GoodsReceiptRepository();
