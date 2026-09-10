import type { Prisma, Shipment } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const SHIPMENT_LIST_INCLUDE = {
  supplier: { select: { id: true, code: true, name: true, currencyCode: true } },
  carrier: { select: { id: true, code: true, name: true } },
  clearingAgent: { select: { id: true, code: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ShipmentInclude;

export const SHIPMENT_DETAIL_INCLUDE = {
  supplier: { select: { id: true, code: true, name: true, currencyCode: true } },
  carrier: { select: { id: true, code: true, name: true } },
  clearingAgent: { select: { id: true, code: true, name: true } },
  items: {
    where: { deletedAt: null },
    orderBy: { lineNumber: 'asc' },
    include: {
      product: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
    },
  },
  containers: { where: { deletedAt: null }, orderBy: { containerNo: 'asc' } },
  charges: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
  documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
  statusHistory: { orderBy: { occurredAt: 'desc' } },
  trackingEvents: { where: { deletedAt: null }, orderBy: { occurredAt: 'desc' } },
  goodsReceipts: {
    where: { deletedAt: null },
    orderBy: { receiptDate: 'desc' },
    include: { warehouse: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ShipmentInclude;

export type ShipmentListItem = Prisma.ShipmentGetPayload<{
  include: typeof SHIPMENT_LIST_INCLUDE;
}>;

export type ShipmentDetail = Prisma.ShipmentGetPayload<{
  include: typeof SHIPMENT_DETAIL_INCLUDE;
}>;

export class ShipmentRepository extends BaseRepository<Shipment> {
  protected readonly entityName = 'Shipment';

  protected delegate(client: DatabaseClient): ModelDelegate<Shipment> {
    return client.shipment as unknown as ModelDelegate<Shipment>;
  }

  buildSearchFilter(search?: string): Prisma.ShipmentWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { shipmentNo: { contains: search } },
        { supplierInvoiceNo: { contains: search } },
        { bookingNo: { contains: search } },
        { masterBlNo: { contains: search } },
        { houseBlNo: { contains: search } },
        { goodsDeclarationNo: { contains: search } },
        { originPort: { contains: search } },
        { destinationPort: { contains: search } },
        { vesselName: { contains: search } },
        { supplier: { name: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient): Promise<ShipmentDetail | null> {
    return resolveClient(client).shipment.findFirst({
      where: { id, deletedAt: null },
      include: SHIPMENT_DETAIL_INCLUDE,
    });
  }

  async findByShipmentNo(shipmentNo: string, client?: DatabaseClient): Promise<Shipment | null> {
    return this.findOne({ shipmentNo }, {}, client);
  }

  async countByStatus(client?: DatabaseClient): Promise<Array<{ status: string; count: number }>> {
    const grouped = (await this.delegate(resolveClient(client)).groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    })) as Array<{ status: string; _count: { _all: number } }>;

    return grouped.map((row) => ({ status: row.status, count: row._count._all }));
  }

  async costTotals(
    where: Prisma.ShipmentWhereInput = {},
    client?: DatabaseClient,
  ): Promise<{ goodsValue: Prisma.Decimal | null; landedCost: Prisma.Decimal | null }> {
    const result = await this.delegate(resolveClient(client)).aggregate({
      where: { ...where, deletedAt: null },
      _sum: { goodsValue: true, totalLandedCost: true },
    });

    return {
      goodsValue: result?._sum?.goodsValue ?? null,
      landedCost: result?._sum?.totalLandedCost ?? null,
    };
  }

  async replaceItems(
    shipmentId: string,
    items: Prisma.ShipmentItemCreateManyInput[],
    client: DatabaseClient,
  ): Promise<void> {
    await client.shipmentItem.deleteMany({ where: { shipmentId } });

    if (items.length > 0) {
      await client.shipmentItem.createMany({ data: items });
    }
  }
}

export const shipmentRepository = new ShipmentRepository();
