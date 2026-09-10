import type { AgentInvoice, AgentPayment, Prisma } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const AGENT_INVOICE_INCLUDE = {
  clearingAgent: { select: { id: true, code: true, name: true, currencyCode: true } },
  shipment: { select: { id: true, shipmentNo: true } },
  items: { where: { deletedAt: null }, orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.AgentInvoiceInclude;

export type AgentInvoiceDetail = Prisma.AgentInvoiceGetPayload<{
  include: typeof AGENT_INVOICE_INCLUDE;
}>;

export class AgentInvoiceRepository extends BaseRepository<AgentInvoice> {
  protected readonly entityName = 'Agent invoice';

  protected delegate(client: DatabaseClient): ModelDelegate<AgentInvoice> {
    return client.agentInvoice as unknown as ModelDelegate<AgentInvoice>;
  }

  buildSearchFilter(search?: string): Prisma.AgentInvoiceWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { invoiceNo: { contains: search } },
        { agentRefNo: { contains: search } },
        { clearingAgent: { name: { contains: search } } },
        { shipment: { shipmentNo: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient): Promise<AgentInvoiceDetail | null> {
    return resolveClient(client).agentInvoice.findFirst({
      where: { id, deletedAt: null },
      include: AGENT_INVOICE_INCLUDE,
    });
  }

  async findOutstandingForAgent(
    clearingAgentId: string,
    client?: DatabaseClient,
  ): Promise<AgentInvoice[]> {
    return this.findAll(
      { clearingAgentId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      { orderBy: { dueDate: 'asc' } },
      client,
    );
  }

  async replaceItems(
    agentInvoiceId: string,
    items: Prisma.AgentInvoiceItemCreateManyInput[],
    client: DatabaseClient,
  ): Promise<void> {
    await client.agentInvoiceItem.deleteMany({ where: { agentInvoiceId } });

    if (items.length > 0) {
      await client.agentInvoiceItem.createMany({ data: items });
    }
  }
}

export class AgentPaymentRepository extends BaseRepository<AgentPayment> {
  protected readonly entityName = 'Agent payment';

  protected delegate(client: DatabaseClient): ModelDelegate<AgentPayment> {
    return client.agentPayment as unknown as ModelDelegate<AgentPayment>;
  }

  buildSearchFilter(search?: string): Prisma.AgentPaymentWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { paymentNo: { contains: search } },
        { referenceNo: { contains: search } },
        { clearingAgent: { name: { contains: search } } },
      ],
    };
  }

  async findDetail(id: string, client?: DatabaseClient) {
    return resolveClient(client).agentPayment.findFirst({
      where: { id, deletedAt: null },
      include: {
        clearingAgent: { select: { id: true, code: true, name: true } },
        allocations: {
          where: { deletedAt: null },
          include: { invoice: { select: { id: true, invoiceNo: true, grandTotal: true } } },
        },
      },
    });
  }
}

export const agentInvoiceRepository = new AgentInvoiceRepository();
export const agentPaymentRepository = new AgentPaymentRepository();
