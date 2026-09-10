import type { ClearingAgent } from '@prisma/client';
import { PartyCrudService, type SearchableRepository } from './party-crud.service';
import { clearingAgentRepository } from '@/repositories/clearing-agent.repository';
import { agentInvoiceRepository } from '@/repositories/agent-invoice.repository';
import { SequenceKey } from '@/database/number-sequence';
import type { TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { toDecimal } from '@/lib/money';
import type {
  CreateClearingAgentInput,
} from '@/schemas/partner.schema';

export interface ClearingAgentSummary {
  unpaidInvoices: number;
  outstandingBalance: string;
}

export class ClearingAgentService extends PartyCrudService<
  ClearingAgent,
  CreateClearingAgentInput,
  Partial<CreateClearingAgentInput>
> {
  protected readonly entityName = 'Clearing agent';
  protected readonly repository = clearingAgentRepository as SearchableRepository<ClearingAgent>;
  protected readonly sequenceKey = SequenceKey.CLEARING_AGENT;

  protected override async assertDeletable(
    record: ClearingAgent,
    tx: TransactionClient,
  ): Promise<void> {
    const unpaid = await agentInvoiceRepository.count(
      { clearingAgentId: record.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      tx,
    );

    if (unpaid > 0) {
      throw new BusinessRuleError(
        `${record.name} has ${unpaid} unpaid invoice(s) and cannot be archived`,
      );
    }
  }

  async summary(id: string): Promise<ClearingAgentSummary> {
    const invoices = await agentInvoiceRepository.findAll({
      clearingAgentId: id,
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    });

    const outstandingBalance = invoices.reduce(
      (total, invoice) => total.plus(toDecimal(invoice.balanceAmount)),
      toDecimal(0),
    );

    return { unpaidInvoices: invoices.length, outstandingBalance: outstandingBalance.toFixed(2) };
  }
}

export const clearingAgentService = new ClearingAgentService();
