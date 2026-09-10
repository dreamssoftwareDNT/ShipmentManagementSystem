import { Prisma, type LedgerAccount, type LedgerEntry } from '@prisma/client';
import { ledgerRepository } from '@/repositories/ledger.repository';
import { convertToBase, roundAmount, toDecimal, type DecimalInput } from '@/lib/money';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import type { DatabaseClient, TransactionClient } from '@/database/unit-of-work';
import type { PageRequest, PageResult } from '@/types/common';
import type { LedgerEntryType, LedgerPartyType, LedgerReferenceType } from '@/types/enums';

export interface LedgerPostingRequest {
  partyType: LedgerPartyType;
  partyId: string;
  partyName: string;
  currencyCode: string;
  exchangeRate: DecimalInput;
  entryDate: Date;
  entryType: LedgerEntryType;
  referenceType: LedgerReferenceType;
  referenceId: string;
  referenceNo: string;
  narration: string;
  debit?: DecimalInput;
  credit?: DecimalInput;
  shipmentId?: string | null;
  actorId: string;
}

export interface LedgerStatementRow {
  id: string;
  entryDate: Date;
  entryType: string;
  referenceType: string;
  referenceNo: string;
  narration: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  runningBalance: Prisma.Decimal;
  isReversal: boolean;
}

export interface LedgerStatement {
  account: LedgerAccount;
  openingBalance: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
  debitTotal: Prisma.Decimal;
  creditTotal: Prisma.Decimal;
  rows: LedgerStatementRow[];
  page: PageResult<LedgerEntry>;
}

/**
 * Posting engine for every party statement in the system.
 *
 * Balance convention: balance = debit - credit.
 *  - Receivables (customers): an invoice debits the account, a receipt credits it,
 *    so a positive balance is money the customer still owes.
 *  - Payables (vendors, clearing agents): an invoice debits the account and a
 *    payment credits it, so a positive balance is money still owed to the party.
 *
 * Entries are never edited or removed. Corrections are posted as mirrored
 * reversal entries so the statement stays a complete audit trail.
 */
export class LedgerService {
  async post(request: LedgerPostingRequest, tx: TransactionClient): Promise<LedgerEntry> {
    const debit = roundAmount(request.debit ?? 0);
    const credit = roundAmount(request.credit ?? 0);

    if (debit.isZero() && credit.isZero()) {
      throw new BusinessRuleError('A ledger entry must carry either a debit or a credit amount');
    }

    if (!debit.isZero() && !credit.isZero()) {
      throw new BusinessRuleError('A ledger entry cannot be both a debit and a credit');
    }

    if (debit.isNegative() || credit.isNegative()) {
      throw new BusinessRuleError('Ledger amounts must be positive');
    }

    const account = await ledgerRepository.ensureAccount(
      {
        partyType: request.partyType,
        partyId: request.partyId,
        partyName: request.partyName,
        currencyCode: request.currencyCode,
      },
      tx,
    );

    const updated = await ledgerRepository.applyBalance(account.id, debit, credit, tx);

    return ledgerRepository.createEntry(
      {
        ledgerAccountId: account.id,
        entryDate: request.entryDate,
        entryType: request.entryType,
        referenceType: request.referenceType,
        referenceId: request.referenceId,
        referenceNo: request.referenceNo,
        narration: request.narration,
        currencyCode: request.currencyCode,
        exchangeRate: toDecimal(request.exchangeRate),
        debit,
        credit,
        balanceAfter: updated.balance,
        baseDebit: convertToBase(debit, request.exchangeRate),
        baseCredit: convertToBase(credit, request.exchangeRate),
        shipmentId: request.shipmentId ?? null,
        createdById: request.actorId,
      },
      tx,
    );
  }

  /**
   * Mirrors every entry written for a reference so a cancelled document leaves
   * the party balance exactly where it was before the document was posted.
   */
  async reverse(
    referenceType: LedgerReferenceType,
    referenceId: string,
    narration: string,
    actorId: string,
    tx: TransactionClient,
  ): Promise<LedgerEntry[]> {
    const originals = await ledgerRepository.findEntriesByReference(referenceType, referenceId, tx);
    const reversals: LedgerEntry[] = [];

    for (const original of originals) {
      if (original.isReversal) {
        continue;
      }

      const account = await tx.ledgerAccount.findUnique({
        where: { id: original.ledgerAccountId },
      });

      if (!account) {
        throw new NotFoundError('Ledger account', original.ledgerAccountId);
      }

      const updated = await ledgerRepository.applyBalance(
        account.id,
        original.credit,
        original.debit,
        tx,
      );

      const reversal = await ledgerRepository.createEntry(
        {
          ledgerAccountId: account.id,
          entryDate: new Date(),
          entryType: original.entryType,
          referenceType: original.referenceType,
          referenceId: original.referenceId,
          referenceNo: original.referenceNo,
          narration,
          currencyCode: original.currencyCode,
          exchangeRate: original.exchangeRate,
          debit: original.credit,
          credit: original.debit,
          balanceAfter: updated.balance,
          baseDebit: original.baseCredit,
          baseCredit: original.baseDebit,
          shipmentId: original.shipmentId,
          isReversal: true,
          reversedEntryId: original.id,
          createdById: actorId,
        },
        tx,
      );

      reversals.push(reversal);
    }

    return reversals;
  }

  async getStatement(
    partyType: LedgerPartyType,
    partyId: string,
    currencyCode: string,
    page: PageRequest,
    filter: { from?: Date; to?: Date } = {},
    client?: DatabaseClient,
  ): Promise<LedgerStatement | null> {
    const account = await ledgerRepository.findAccount(
      { partyType, partyId, currencyCode },
      client,
    );

    if (!account) {
      return null;
    }

    const openingBalance = filter.from
      ? await ledgerRepository.openingBalance(account.id, filter.from, client)
      : new Prisma.Decimal(0);

    const pageResult = await ledgerRepository.statement(account.id, filter, page, client);

    let running = openingBalance;
    const rows: LedgerStatementRow[] = pageResult.items.map((entry) => {
      running = running.plus(entry.debit).minus(entry.credit);

      return {
        id: entry.id,
        entryDate: entry.entryDate,
        entryType: entry.entryType,
        referenceType: entry.referenceType,
        referenceNo: entry.referenceNo,
        narration: entry.narration,
        debit: entry.debit,
        credit: entry.credit,
        runningBalance: running,
        isReversal: entry.isReversal,
      };
    });

    const debitTotal = rows.reduce<Prisma.Decimal>(
      (total, row) => total.plus(row.debit),
      new Prisma.Decimal(0),
    );
    const creditTotal = rows.reduce<Prisma.Decimal>(
      (total, row) => total.plus(row.credit),
      new Prisma.Decimal(0),
    );

    return {
      account,
      openingBalance,
      closingBalance: running,
      debitTotal,
      creditTotal,
      rows,
      page: pageResult,
    };
  }

  async listAccounts(partyType: LedgerPartyType, client?: DatabaseClient) {
    return ledgerRepository.listAccounts(partyType, client);
  }
}

export const ledgerService = new LedgerService();
