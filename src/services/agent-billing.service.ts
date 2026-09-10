import { Prisma, type AgentInvoice, type AgentPayment } from '@prisma/client';
import { BaseService } from './base.service';
import { ledgerService } from './ledger.service';
import { shipmentService } from './shipment.service';
import { InvoiceCalculator } from './billing/invoice-calculator';
import { PaymentAllocator, type AllocatableInvoice } from './billing/payment-allocator';
import {
  agentInvoiceRepository,
  agentPaymentRepository,
  type AgentInvoiceDetail,
} from '@/repositories/agent-invoice.repository';
import { clearingAgentRepository } from '@/repositories/clearing-agent.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork, type TransactionClient } from '@/database/unit-of-work';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { convertToBase, roundAmount, toDecimal } from '@/lib/money';
import {
  AuditAction,
  InvoiceStatus,
  LedgerEntryType,
  LedgerPartyType,
  LedgerReferenceType,
  PaymentStatus,
} from '@/types/enums';
import type {
  CancelDocumentInput,
  CreateAgentInvoiceInput,
  CreatePaymentInput,
  InvoiceQueryInput,
  PaymentQueryInput,
} from '@/schemas/billing.schema';
import type { PageResult, RequestContext } from '@/types/common';

/**
 * Clearing agents bill for their own service fees plus customs duty and other
 * amounts they advance on the shipment's behalf. Duty and reimbursable costs
 * are held outside the taxable line total but still form part of what is owed.
 */
export class AgentInvoiceService extends BaseService {
  private readonly entityName = 'Agent invoice';

  async list(query: InvoiceQueryInput): Promise<PageResult<AgentInvoice>> {
    const page = this.normalizePage(query);

    const where: Prisma.AgentInvoiceWhereInput = {
      ...agentInvoiceRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.partyId ? { clearingAgentId: query.partyId } : {}),
      ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return agentInvoiceRepository.paginate(where, page, {
      include: {
        clearingAgent: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { invoiceDate: 'desc' },
    });
  }

  async getDetail(id: string): Promise<AgentInvoiceDetail> {
    const invoice = await agentInvoiceRepository.findDetail(id);

    if (!invoice) {
      throw new NotFoundError(this.entityName, id);
    }

    return invoice;
  }

  async create(
    input: CreateAgentInvoiceInput,
    context: RequestContext,
  ): Promise<AgentInvoiceDetail> {
    const invoiceId = await UnitOfWork.run(async (tx) => {
      const agent = await clearingAgentRepository.requireById(input.clearingAgentId, {}, tx);

      const document = InvoiceCalculator.calculate(input.items, input.exchangeRate, [
        input.dutyAmount,
        input.reimbursable,
      ]);

      const invoiceNo = await documentNumberGenerator.next(
        SequenceKey.AGENT_INVOICE,
        tx,
        input.invoiceDate,
      );

      const status = InvoiceCalculator.deriveStatus(
        document.grandTotal,
        new Prisma.Decimal(0),
        input.dueDate,
      );

      const invoice = await tx.agentInvoice.create({
        data: {
          invoiceNo,
          agentRefNo: input.agentRefNo ?? null,
          clearingAgentId: agent.id,
          shipmentId: input.shipmentId ?? null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          status,
          subTotal: document.subTotal,
          taxTotal: document.taxTotal,
          dutyAmount: toDecimal(input.dutyAmount),
          reimbursable: toDecimal(input.reimbursable),
          grandTotal: document.grandTotal,
          baseGrandTotal: document.baseGrandTotal,
          paidAmount: new Prisma.Decimal(0),
          balanceAmount: document.grandTotal,
          postedAt: new Date(),
          remarks: input.remarks ?? null,
          createdById: context.user.id,
          updatedById: context.user.id,
          items: {
            create: document.lines.map((line) => ({
              lineNumber: line.lineNumber,
              description: line.description,
              chargeCategory: line.serviceCode ?? 'SERVICE',
              quantity: line.quantity,
              unitRate: line.unitRate,
              taxRate: line.taxRate,
              lineSubTotal: line.lineSubTotal,
              lineTaxAmount: line.lineTaxAmount,
              lineTotal: line.lineTotal,
              createdById: context.user.id,
              updatedById: context.user.id,
            })),
          },
        },
      });

      await ledgerService.post(
        {
          partyType: LedgerPartyType.CLEARING_AGENT,
          partyId: agent.id,
          partyName: agent.name,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          entryDate: input.invoiceDate,
          entryType: LedgerEntryType.INVOICE,
          referenceType: LedgerReferenceType.AGENT_INVOICE,
          referenceId: invoice.id,
          referenceNo: invoiceNo,
          narration: `Clearing agent invoice ${invoiceNo}`,
          debit: document.grandTotal,
          shipmentId: input.shipmentId ?? null,
          actorId: context.user.id,
        },
        tx,
      );

      if (input.shipmentId) {
        await shipmentService.recalculateActuals(input.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: invoice.id,
          action: AuditAction.POST,
          summary: `Posted agent invoice ${invoiceNo} for ${document.grandTotal.toFixed(2)} ${input.currencyCode}`,
        },
        tx,
      );

      return invoice.id;
    });

    return this.getDetail(invoiceId);
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<AgentInvoice> {
    return UnitOfWork.run(async (tx) => {
      const invoice = await agentInvoiceRepository.requireById(id, {}, tx);

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BusinessRuleError(`Invoice ${invoice.invoiceNo} is already cancelled`);
      }

      if (toDecimal(invoice.paidAmount).greaterThan(0)) {
        throw new BusinessRuleError(
          `Invoice ${invoice.invoiceNo} has payments allocated to it. Reverse the payments first.`,
        );
      }

      await ledgerService.reverse(
        LedgerReferenceType.AGENT_INVOICE,
        id,
        `Cancelled invoice ${invoice.invoiceNo}: ${input.reason}`,
        context.user.id,
        tx,
      );

      const cancelled = await tx.agentInvoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason,
          balanceAmount: new Prisma.Decimal(0),
          updatedById: context.user.id,
        },
      });

      if (invoice.shipmentId) {
        await shipmentService.recalculateActuals(invoice.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.CANCEL,
          summary: `Cancelled agent invoice ${invoice.invoiceNo}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  async outstandingForAgent(agentId: string) {
    const invoices = await agentInvoiceRepository.findOutstandingForAgent(agentId);

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currencyCode: invoice.currencyCode,
      grandTotal: invoice.grandTotal.toFixed(2),
      paidAmount: invoice.paidAmount.toFixed(2),
      balanceAmount: invoice.balanceAmount.toFixed(2),
      status: invoice.status,
    }));
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export class AgentPaymentService extends BaseService {
  private readonly entityName = 'Agent payment';

  async list(query: PaymentQueryInput): Promise<PageResult<AgentPayment>> {
    const page = this.normalizePage(query);

    const where: Prisma.AgentPaymentWhereInput = {
      ...agentPaymentRepository.buildSearchFilter(page.search),
      ...(query.partyId ? { clearingAgentId: query.partyId } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.from || query.to
        ? {
            paymentDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return agentPaymentRepository.paginate(where, page, {
      include: { clearingAgent: { select: { id: true, code: true, name: true } } },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getDetail(id: string) {
    const payment = await agentPaymentRepository.findDetail(id);

    if (!payment) {
      await agentPaymentRepository.requireById(id);
    }

    return payment;
  }

  async create(input: CreatePaymentInput, context: RequestContext): Promise<AgentPayment> {
    return UnitOfWork.run(async (tx) => {
      const agent = await clearingAgentRepository.requireById(input.partyId, {}, tx);
      const amount = roundAmount(input.amount);

      const allocations = await PaymentAllocator.apply(
        {
          partyId: agent.id,
          paymentAmount: amount,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          allocations: input.allocations,
          loadInvoice: (invoiceId, client) => this.loadInvoice(invoiceId, client),
        },
        tx,
      );

      const paymentNo = await documentNumberGenerator.next(
        SequenceKey.AGENT_PAYMENT,
        tx,
        input.paymentDate,
      );

      const payment = await tx.agentPayment.create({
        data: {
          paymentNo,
          clearingAgentId: agent.id,
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          currencyCode: input.currencyCode,
          exchangeRate: toDecimal(input.exchangeRate),
          amount,
          baseAmount: convertToBase(amount, input.exchangeRate),
          allocatedAmount: PaymentAllocator.totalOf(allocations),
          status: PaymentStatus.POSTED,
          referenceNo: input.referenceNo ?? null,
          remarks: input.remarks ?? null,
          createdById: context.user.id,
          updatedById: context.user.id,
        },
      });

      for (const allocation of allocations) {
        await tx.agentPaymentAllocation.create({
          data: {
            agentPaymentId: payment.id,
            agentInvoiceId: allocation.invoiceId,
            amount: allocation.amount,
            baseAmount: allocation.baseAmount,
            createdById: context.user.id,
            updatedById: context.user.id,
          },
        });

        await tx.agentInvoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: allocation.settledAmount,
            balanceAmount: allocation.outstandingAfter,
            status: allocation.status,
            updatedById: context.user.id,
          },
        });
      }

      await ledgerService.post(
        {
          partyType: LedgerPartyType.CLEARING_AGENT,
          partyId: agent.id,
          partyName: agent.name,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          entryDate: input.paymentDate,
          entryType: LedgerEntryType.PAYMENT,
          referenceType: LedgerReferenceType.AGENT_PAYMENT,
          referenceId: payment.id,
          referenceNo: paymentNo,
          narration: `Payment ${paymentNo} to ${agent.name}`,
          credit: amount,
          actorId: context.user.id,
        },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: payment.id,
          action: AuditAction.POST,
          summary: `Paid ${amount.toFixed(2)} ${input.currencyCode} to ${agent.name} (${paymentNo})`,
        },
        tx,
      );

      return payment;
    });
  }

  async cancel(
    id: string,
    input: CancelDocumentInput,
    context: RequestContext,
  ): Promise<AgentPayment> {
    return UnitOfWork.run(async (tx) => {
      const payment = await agentPaymentRepository.requireById(id, {}, tx);

      if (payment.status === PaymentStatus.CANCELLED) {
        throw new BusinessRuleError(`Payment ${payment.paymentNo} is already cancelled`);
      }

      const allocations = await tx.agentPaymentAllocation.findMany({
        where: { agentPaymentId: id, deletedAt: null },
      });

      for (const allocation of allocations) {
        const invoice = await tx.agentInvoice.findUniqueOrThrow({
          where: { id: allocation.agentInvoiceId },
        });

        const paidAmount = roundAmount(
          toDecimal(invoice.paidAmount).minus(toDecimal(allocation.amount)),
        );

        await tx.agentInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount,
            balanceAmount: roundAmount(toDecimal(invoice.grandTotal).minus(paidAmount)),
            status: InvoiceCalculator.deriveStatus(
              toDecimal(invoice.grandTotal),
              paidAmount,
              invoice.dueDate,
            ),
            updatedById: context.user.id,
          },
        });

        await tx.agentPaymentAllocation.update({
          where: { id: allocation.id },
          data: { deletedAt: new Date(), deletedById: context.user.id },
        });
      }

      await ledgerService.reverse(
        LedgerReferenceType.AGENT_PAYMENT,
        id,
        `Cancelled payment ${payment.paymentNo}: ${input.reason}`,
        context.user.id,
        tx,
      );

      const cancelled = await tx.agentPayment.update({
        where: { id },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: input.reason,
          allocatedAmount: new Prisma.Decimal(0),
          updatedById: context.user.id,
        },
      });

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.CANCEL,
          summary: `Cancelled agent payment ${payment.paymentNo}`,
          changes: { reason: input.reason },
        },
        tx,
      );

      return cancelled;
    });
  }

  private async loadInvoice(
    invoiceId: string,
    tx: TransactionClient,
  ): Promise<AllocatableInvoice | null> {
    const invoice = await tx.agentInvoice.findFirst({
      where: { id: invoiceId, deletedAt: null },
    });

    if (!invoice) {
      return null;
    }

    return {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      currencyCode: invoice.currencyCode,
      grandTotal: invoice.grandTotal,
      settledAmount: invoice.paidAmount,
      dueDate: invoice.dueDate,
      status: invoice.status,
      partyId: invoice.clearingAgentId,
    };
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const agentInvoiceService = new AgentInvoiceService();
export const agentPaymentService = new AgentPaymentService();
