import { Prisma, type Expense } from '@prisma/client';
import { BaseService } from './base.service';
import { shipmentService } from './shipment.service';
import {
  expenseCategoryRepository,
  expenseRepository,
} from '@/repositories/expense.repository';
import { shipmentRepository } from '@/repositories/shipment.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork } from '@/database/unit-of-work';
import { BusinessRuleError } from '@/lib/errors';
import { convertToBase, roundAmount } from '@/lib/money';
import { AuditAction, ExpenseStatus } from '@/types/enums';
import type { CreateExpenseInput, ExpenseQueryInput } from '@/schemas/expense.schema';
import type { PageResult, RequestContext, SelectOption } from '@/types/common';

export class ExpenseService extends BaseService {
  private readonly entityName = 'Expense';

  async list(query: ExpenseQueryInput): Promise<PageResult<Expense>> {
    const page = this.normalizePage(query);

    const where: Prisma.ExpenseWhereInput = {
      ...expenseRepository.buildSearchFilter(page.search),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            expenseDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    return expenseRepository.paginate(where, page, {
      include: {
        category: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { expenseDate: 'desc' },
    });
  }

  async getById(id: string): Promise<Expense> {
    return expenseRepository.requireById(id, {
      include: {
        category: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
    });
  }

  async categoryOptions(): Promise<SelectOption[]> {
    const categories = await expenseCategoryRepository.listActive();

    return categories.map((category) => ({
      value: category.id,
      label: category.name,
      hint: category.code,
    }));
  }

  async create(input: CreateExpenseInput, context: RequestContext): Promise<Expense> {
    return UnitOfWork.run(async (tx) => {
      await expenseCategoryRepository.requireById(input.categoryId, {}, tx);

      if (input.shipmentId) {
        await shipmentRepository.requireById(input.shipmentId, {}, tx);
      }

      const amount = roundAmount(input.amount);
      const taxAmount = roundAmount(input.taxAmount);
      const totalAmount = roundAmount(amount.plus(taxAmount));

      const expenseNo = await documentNumberGenerator.next(
        SequenceKey.EXPENSE,
        tx,
        input.expenseDate,
      );

      const expense = await expenseRepository.create(
        {
          expenseNo,
          categoryId: input.categoryId,
          shipmentId: input.shipmentId ?? null,
          expenseDate: input.expenseDate,
          description: input.description,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          amount,
          taxAmount,
          totalAmount,
          baseAmount: convertToBase(totalAmount, input.exchangeRate),
          paymentMethod: input.paymentMethod,
          status: ExpenseStatus.RECORDED,
          isBillable: input.isBillable,
          referenceNo: input.referenceNo ?? null,
        },
        { userId: context.user.id },
        tx,
      );

      if (input.shipmentId) {
        await shipmentService.recalculateActuals(input.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: expense.id,
          action: AuditAction.CREATE,
          summary: `Recorded expense ${expenseNo} for ${totalAmount.toFixed(2)} ${input.currencyCode}`,
        },
        tx,
      );

      return expense;
    });
  }

  async update(
    id: string,
    input: CreateExpenseInput,
    context: RequestContext,
  ): Promise<Expense> {
    return UnitOfWork.run(async (tx) => {
      const existing = await expenseRepository.requireById(id, {}, tx);

      if (existing.status === ExpenseStatus.APPROVED) {
        throw new BusinessRuleError(
          `Expense ${existing.expenseNo} has been approved and can no longer be edited`,
        );
      }

      const amount = roundAmount(input.amount);
      const taxAmount = roundAmount(input.taxAmount);
      const totalAmount = roundAmount(amount.plus(taxAmount));

      const updated = await expenseRepository.update(
        id,
        {
          categoryId: input.categoryId,
          shipmentId: input.shipmentId ?? null,
          expenseDate: input.expenseDate,
          description: input.description,
          currencyCode: input.currencyCode,
          exchangeRate: input.exchangeRate,
          amount,
          taxAmount,
          totalAmount,
          baseAmount: convertToBase(totalAmount, input.exchangeRate),
          paymentMethod: input.paymentMethod,
          isBillable: input.isBillable,
          referenceNo: input.referenceNo ?? null,
        },
        { userId: context.user.id },
        tx,
      );

      for (const shipmentId of new Set(
        [existing.shipmentId, input.shipmentId].filter((value): value is string => Boolean(value)),
      )) {
        await shipmentService.recalculateActuals(shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated expense ${existing.expenseNo}`,
        },
        tx,
      );

      return updated;
    });
  }

  async approve(id: string, context: RequestContext): Promise<Expense> {
    return UnitOfWork.run(async (tx) => {
      const expense = await expenseRepository.requireById(id, {}, tx);

      if (expense.status !== ExpenseStatus.RECORDED) {
        throw new BusinessRuleError(
          `Expense ${expense.expenseNo} is ${expense.status.toLowerCase()} and cannot be approved`,
        );
      }

      const approved = await expenseRepository.update(
        id,
        {
          status: ExpenseStatus.APPROVED,
          approvedById: context.user.id,
          approvedAt: new Date(),
        },
        { userId: context.user.id },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.APPROVE,
          summary: `Approved expense ${expense.expenseNo}`,
        },
        tx,
      );

      return approved;
    });
  }

  async reject(id: string, reason: string, context: RequestContext): Promise<Expense> {
    return UnitOfWork.run(async (tx) => {
      const expense = await expenseRepository.requireById(id, {}, tx);

      const rejected = await expenseRepository.update(
        id,
        { status: ExpenseStatus.REJECTED },
        { userId: context.user.id },
        tx,
      );

      if (expense.shipmentId) {
        await shipmentService.recalculateActuals(expense.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.STATUS_CHANGE,
          summary: `Rejected expense ${expense.expenseNo}`,
          changes: { reason },
        },
        tx,
      );

      return rejected;
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const expense = await expenseRepository.requireById(id, {}, tx);

      if (expense.status === ExpenseStatus.APPROVED) {
        throw new BusinessRuleError(
          `Expense ${expense.expenseNo} has been approved and cannot be removed`,
        );
      }

      await expenseRepository.softDelete(id, { userId: context.user.id }, tx);

      if (expense.shipmentId) {
        await shipmentService.recalculateActuals(expense.shipmentId, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Removed expense ${expense.expenseNo}`,
        },
        tx,
      );
    });
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export const expenseService = new ExpenseService();
