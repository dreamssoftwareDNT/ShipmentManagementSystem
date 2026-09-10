import type { Vendor } from '@prisma/client';
import { PartyCrudService, type PartyListQuery, type SearchableRepository } from './party-crud.service';
import { vendorRepository } from '@/repositories/vendor.repository';
import { vendorTypeRepository } from '@/repositories/vendor-type.repository';
import { vendorInvoiceRepository } from '@/repositories/vendor-invoice.repository';
import { purchaseOrderRepository } from '@/repositories/purchase-order.repository';
import { SequenceKey } from '@/database/number-sequence';
import type { TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { toDecimal } from '@/lib/money';
import type { CreateVendorInput, UpdateVendorInput, VendorQueryInput } from '@/schemas/vendor.schema';
import type { SelectOption } from '@/types/common';

export interface VendorSummary {
  openPurchaseOrders: number;
  unpaidInvoices: number;
  outstandingBalance: string;
}

export class VendorService extends PartyCrudService<Vendor, CreateVendorInput, UpdateVendorInput> {
  protected readonly entityName = 'Vendor';
  protected readonly repository = vendorRepository as SearchableRepository<Vendor>;
  protected readonly sequenceKey = SequenceKey.VENDOR;

  protected override additionalFilters(query: PartyListQuery): Record<string, unknown> {
    const typed = query as VendorQueryInput;
    return typed.vendorTypeId ? { vendorTypeId: typed.vendorTypeId } : {};
  }

  protected override async assertDeletable(record: Vendor, tx: TransactionClient): Promise<void> {
    const unpaid = await vendorInvoiceRepository.count(
      { vendorId: record.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      tx,
    );

    if (unpaid > 0) {
      throw new BusinessRuleError(
        `${record.name} has ${unpaid} unpaid invoice(s) and cannot be archived`,
      );
    }

    const openOrders = await purchaseOrderRepository.count(
      { vendorId: record.id, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] } },
      tx,
    );

    if (openOrders > 0) {
      throw new BusinessRuleError(
        `${record.name} has ${openOrders} open purchase order(s) and cannot be archived`,
      );
    }
  }

  async typeOptions(): Promise<SelectOption[]> {
    const types = await vendorTypeRepository.listActive();

    return types.map((type) => ({ value: type.id, label: type.name, hint: type.code }));
  }

  async summary(id: string): Promise<VendorSummary> {
    const [openPurchaseOrders, invoices] = await Promise.all([
      purchaseOrderRepository.count({
        vendorId: id,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
      }),
      vendorInvoiceRepository.findAll({
        vendorId: id,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      }),
    ]);

    const outstandingBalance = invoices.reduce(
      (total, invoice) => total.plus(toDecimal(invoice.balanceAmount)),
      toDecimal(0),
    );

    return {
      openPurchaseOrders,
      unpaidInvoices: invoices.length,
      outstandingBalance: outstandingBalance.toFixed(2),
    };
  }
}

export const vendorService = new VendorService();
