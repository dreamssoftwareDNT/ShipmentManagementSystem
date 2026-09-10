import { Prisma, type LedgerAccount, type LedgerEntry } from '@prisma/client';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';
import type { LedgerPartyType } from '@/types/enums';
import type { PageRequest, PageResult } from '@/types/common';

export interface LedgerAccountKey {
  partyType: LedgerPartyType;
  partyId: string;
  partyName: string;
  currencyCode: string;
}

export interface LedgerStatementFilter {
  from?: Date;
  to?: Date;
  referenceType?: string;
}

export class LedgerRepository {
  async findAccount(
    key: Omit<LedgerAccountKey, 'partyName'>,
    client?: DatabaseClient,
  ): Promise<LedgerAccount | null> {
    return resolveClient(client).ledgerAccount.findFirst({
      where: {
        partyType: key.partyType,
        partyId: key.partyId,
        currencyCode: key.currencyCode,
      },
    });
  }

  async ensureAccount(key: LedgerAccountKey, client: DatabaseClient): Promise<LedgerAccount> {
    const existing = await this.findAccount(key, client);

    if (existing) {
      return existing;
    }

    return client.ledgerAccount.create({
      data: {
        partyType: key.partyType,
        partyId: key.partyId,
        partyName: key.partyName,
        currencyCode: key.currencyCode,
      },
    });
  }

  async applyBalance(
    accountId: string,
    debit: Prisma.Decimal,
    credit: Prisma.Decimal,
    client: DatabaseClient,
  ): Promise<LedgerAccount> {
    return client.ledgerAccount.update({
      where: { id: accountId },
      data: {
        debitTotal: { increment: debit },
        creditTotal: { increment: credit },
        balance: { increment: debit.minus(credit) },
      },
    });
  }

  async createEntry(
    data: Prisma.LedgerEntryUncheckedCreateInput,
    client: DatabaseClient,
  ): Promise<LedgerEntry> {
    return client.ledgerEntry.create({ data });
  }

  async findEntriesByReference(
    referenceType: string,
    referenceId: string,
    client?: DatabaseClient,
  ): Promise<LedgerEntry[]> {
    return resolveClient(client).ledgerEntry.findMany({
      where: { referenceType, referenceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async openingBalance(
    accountId: string,
    before: Date,
    client?: DatabaseClient,
  ): Promise<Prisma.Decimal> {
    const result = await resolveClient(client).ledgerEntry.aggregate({
      where: { ledgerAccountId: accountId, entryDate: { lt: before } },
      _sum: { debit: true, credit: true },
    });

    const debit = result._sum.debit ?? new Prisma.Decimal(0);
    const credit = result._sum.credit ?? new Prisma.Decimal(0);

    return debit.minus(credit);
  }

  async statement(
    accountId: string,
    filter: LedgerStatementFilter,
    page: PageRequest,
    client?: DatabaseClient,
  ): Promise<PageResult<LedgerEntry>> {
    const db = resolveClient(client);
    const where: Prisma.LedgerEntryWhereInput = {
      ledgerAccountId: accountId,
      ...(filter.referenceType ? { referenceType: filter.referenceType } : {}),
      ...(filter.from || filter.to
        ? {
            entryDate: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const skip = (page.page - 1) * page.pageSize;

    const [total, items] = await Promise.all([
      db.ledgerEntry.count({ where }),
      db.ledgerEntry.findMany({
        where,
        orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: page.pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

    return {
      items,
      page: page.page,
      pageSize: page.pageSize,
      total,
      totalPages,
      hasNext: page.page < totalPages,
      hasPrevious: page.page > 1,
    };
  }

  async listAccounts(
    partyType: LedgerPartyType,
    client?: DatabaseClient,
  ): Promise<LedgerAccount[]> {
    return resolveClient(client).ledgerAccount.findMany({
      where: { partyType },
      orderBy: { partyName: 'asc' },
    });
  }
}

export const ledgerRepository = new LedgerRepository();
