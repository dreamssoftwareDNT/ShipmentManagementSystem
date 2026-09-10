import type { Expense, ExpenseCategory, Prisma } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export class ExpenseCategoryRepository extends BaseRepository<ExpenseCategory> {
  protected readonly entityName = 'Expense category';

  protected delegate(client: DatabaseClient): ModelDelegate<ExpenseCategory> {
    return client.expenseCategory as unknown as ModelDelegate<ExpenseCategory>;
  }

  async listActive(client?: DatabaseClient): Promise<ExpenseCategory[]> {
    return this.findAll({ isActive: true }, { orderBy: { name: 'asc' } }, client);
  }
}

export class ExpenseRepository extends BaseRepository<Expense> {
  protected readonly entityName = 'Expense';

  protected delegate(client: DatabaseClient): ModelDelegate<Expense> {
    return client.expense as unknown as ModelDelegate<Expense>;
  }

  buildSearchFilter(search?: string): Prisma.ExpenseWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { expenseNo: { contains: search } },
        { description: { contains: search } },
        { referenceNo: { contains: search } },
        { shipment: { shipmentNo: { contains: search } } },
      ],
    };
  }

  async totalForPeriod(
    from: Date,
    to: Date,
    client?: DatabaseClient,
  ): Promise<Prisma.Decimal> {
    const result = await this.delegate(resolveClient(client)).aggregate({
      where: { deletedAt: null, expenseDate: { gte: from, lte: to } },
      _sum: { baseAmount: true },
    });

    return (result?._sum?.baseAmount ?? null) as unknown as Prisma.Decimal;
  }
}

export const expenseCategoryRepository = new ExpenseCategoryRepository();
export const expenseRepository = new ExpenseRepository();
