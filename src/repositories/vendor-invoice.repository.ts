import type { Prisma, VendorInvoice, VendorPayment } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const VENDOR_INVOICE_INCLUDE = {
  vendor: { select: { id: true, code: true, name: true, currencyCode: true } },
  shipment: { select: { id: true, shipmentNo: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  items: { where: { deletedAt: null }, orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.VendorInvoiceInclude;

export type VendorInvoiceDetail = Prisma.VendorInvoiceGetPayload<{
  include: typeof VENDOR_INVOICE_INCLUDE;
}>;

export class VendorInvoiceRepository extends BaseRepository<VendorInvoice> {
  protected readonly entityName = 'Vendor invoice';

  protected delegate(client: DatabaseClient): ModelDelegate<VendorInvoice> {
    return client.vendorInvoice as unknown as ModelDelegate<VendorInvoice>;
  }

  buildSearchFilter(search?: string): Prisma.VendorInvoiceWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { invoiceNo: { contains: search } },
        { vendorRefNo: { contains: search } },
        { vendor: { name: { contains: search } } },
        { shipment: { shipmentNo: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient): Promise<VendorInvoiceDetail | null> {
    return resolveClient(client).vendorInvoice.findFirst({
      where: { id, deletedAt: null },
      include: VENDOR_INVOICE_INCLUDE,
    });
  }

  async findOutstandingForVendor(
    vendorId: string,
    client?: DatabaseClient,
  ): Promise<VendorInvoice[]> {
    return this.findAll(
      { vendorId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      { orderBy: { dueDate: 'asc' } },
      client,
    );
  }

  async replaceItems(
    vendorInvoiceId: string,
    items: Prisma.VendorInvoiceItemCreateManyInput[],
    client: DatabaseClient,
  ): Promise<void> {
    await client.vendorInvoiceItem.deleteMany({ where: { vendorInvoiceId } });

    if (items.length > 0) {
      await client.vendorInvoiceItem.createMany({ data: items });
    }
  }

  async outstandingTotal(client?: DatabaseClient): Promise<Prisma.Decimal | null> {
    const result = await this.delegate(resolveClient(client)).aggregate({
      where: { deletedAt: null, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      _sum: { balanceAmount: true },
    });

    return result?._sum?.balanceAmount ?? null;
  }
}

export class VendorPaymentRepository extends BaseRepository<VendorPayment> {
  protected readonly entityName = 'Vendor payment';

  protected delegate(client: DatabaseClient): ModelDelegate<VendorPayment> {
    return client.vendorPayment as unknown as ModelDelegate<VendorPayment>;
  }

  buildSearchFilter(search?: string): Prisma.VendorPaymentWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { paymentNo: { contains: search } },
        { referenceNo: { contains: search } },
        { chequeNo: { contains: search } },
        { vendor: { name: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient) {
    return resolveClient(client).vendorPayment.findFirst({
      where: { id, deletedAt: null },
      include: {
        vendor: { select: { id: true, code: true, name: true } },
        allocations: {
          where: { deletedAt: null },
          include: { invoice: { select: { id: true, invoiceNo: true, grandTotal: true } } },
        },
      },
    });
  }
}

export const vendorInvoiceRepository = new VendorInvoiceRepository();
export const vendorPaymentRepository = new VendorPaymentRepository();
