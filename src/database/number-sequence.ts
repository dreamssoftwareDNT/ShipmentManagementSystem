import type { TransactionClient } from '@/database/unit-of-work';
import { UnitOfWork } from '@/database/unit-of-work';

export const SequenceKey = {
  SHIPMENT: 'SHIPMENT',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  VENDOR_INVOICE: 'VENDOR_INVOICE',
  VENDOR_PAYMENT: 'VENDOR_PAYMENT',
  AGENT_INVOICE: 'AGENT_INVOICE',
  AGENT_PAYMENT: 'AGENT_PAYMENT',
  EXPENSE: 'EXPENSE',
  GOODS_RECEIPT: 'GOODS_RECEIPT',
  PRODUCT: 'PRODUCT',
  CURRENCY_EXCHANGE: 'CURRENCY_EXCHANGE',
  VENDOR: 'VENDOR',
  CLEARING_AGENT: 'CLEARING_AGENT',
  MONEY_CHANGER: 'MONEY_CHANGER',
} as const;
export type SequenceKey = (typeof SequenceKey)[keyof typeof SequenceKey];

const PREFIXES: Record<SequenceKey, string> = {
  SHIPMENT: 'SHP',
  PURCHASE_ORDER: 'PO',
  VENDOR_INVOICE: 'VINV',
  VENDOR_PAYMENT: 'VPAY',
  AGENT_INVOICE: 'AINV',
  AGENT_PAYMENT: 'APAY',
  EXPENSE: 'EXP',
  GOODS_RECEIPT: 'GRN',
  PRODUCT: 'PRD',
  CURRENCY_EXCHANGE: 'FX',
  VENDOR: 'VEN',
  CLEARING_AGENT: 'AGT',
  MONEY_CHANGER: 'MCH',
};

/**
 * Allocates gap free document numbers. The upsert plus increment is executed
 * inside the caller's transaction so a rolled back document also releases its
 * number.
 */
export class DocumentNumberGenerator {
  async next(key: SequenceKey, tx: TransactionClient, reference = new Date()): Promise<string> {
    const period = String(reference.getFullYear());
    const prefix = PREFIXES[key];

    const sequence = await tx.numberSequence.upsert({
      where: { key_period: { key, period } },
      create: { key, period, prefix, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    return this.format(prefix, period, sequence.lastNumber, sequence.padding);
  }

  async nextStandalone(key: SequenceKey, reference = new Date()): Promise<string> {
    return UnitOfWork.run((tx) => this.next(key, tx, reference));
  }

  private format(prefix: string, period: string, value: number, padding: number): string {
    return `${prefix}-${period}-${String(value).padStart(padding, '0')}`;
  }
}

export const documentNumberGenerator = new DocumentNumberGenerator();
