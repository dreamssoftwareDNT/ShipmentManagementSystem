import type { CurrencyExchange, MoneyChanger, Prisma } from '@prisma/client';
import { PartyCrudService, type SearchableRepository } from './party-crud.service';
import { BaseService } from './base.service';
import { ledgerService } from './ledger.service';
import {
  currencyExchangeRepository,
  moneyChangerRepository,
} from '@/repositories/money-changer.repository';
import { SequenceKey, documentNumberGenerator } from '@/database/number-sequence';
import { UnitOfWork } from '@/database/unit-of-work';
import { roundAmount, toDecimal } from '@/lib/money';
import { AuditAction, LedgerEntryType, LedgerPartyType, LedgerReferenceType } from '@/types/enums';
import type {
  CreateCurrencyExchangeInput,
  CreateMoneyChangerInput,
  CurrencyExchangeQueryInput,
} from '@/schemas/partner.schema';
import type { PageResult, RequestContext } from '@/types/common';

export class MoneyChangerService extends PartyCrudService<
  MoneyChanger,
  CreateMoneyChangerInput,
  Partial<CreateMoneyChangerInput>
> {
  protected readonly entityName = 'Money changer';
  protected readonly repository = moneyChangerRepository as SearchableRepository<MoneyChanger>;
  protected readonly sequenceKey = SequenceKey.MONEY_CHANGER;
}

/**
 * Currency conversions carried out through a money changer. The converted
 * amount and commission are derived on the server so the stored figures can
 * never disagree with the quoted rate.
 */
export class CurrencyExchangeService extends BaseService {
  private readonly entityName = 'Currency exchange';

  async list(query: CurrencyExchangeQueryInput): Promise<PageResult<CurrencyExchange>> {
    const page = this.normalizePage(query);

    const where: Prisma.CurrencyExchangeWhereInput = {
      ...currencyExchangeRepository.buildSearchFilter(page.search),
      ...(query.moneyChangerId ? { moneyChangerId: query.moneyChangerId } : {}),
      ...(query.fromCurrency ? { fromCurrency: query.fromCurrency.toUpperCase() } : {}),
      ...(query.toCurrency ? { toCurrency: query.toCurrency.toUpperCase() } : {}),
    };

    return currencyExchangeRepository.paginate(where, page, {
      include: { moneyChanger: { select: { id: true, code: true, name: true } } },
      orderBy: { exchangeDate: 'desc' },
    });
  }

  async getById(id: string): Promise<CurrencyExchange> {
    return currencyExchangeRepository.requireById(id, {
      include: {
        moneyChanger: { select: { id: true, code: true, name: true } },
        shipment: { select: { id: true, shipmentNo: true } },
      },
    });
  }

  async create(
    input: CreateCurrencyExchangeInput,
    context: RequestContext,
  ): Promise<CurrencyExchange> {
    return UnitOfWork.run(async (tx) => {
      const changer = await moneyChangerRepository.requireById(input.moneyChangerId, {}, tx);

      const fromAmount = roundAmount(input.fromAmount);
      const rate = toDecimal(input.rate);
      const toAmount = roundAmount(fromAmount.times(rate));
      const commission = roundAmount(input.commission);
      const netAmount = roundAmount(toAmount.minus(commission));

      const referenceNo = await documentNumberGenerator.next(
        SequenceKey.CURRENCY_EXCHANGE,
        tx,
        input.exchangeDate,
      );

      const exchange = await currencyExchangeRepository.create(
        {
          referenceNo,
          moneyChangerId: input.moneyChangerId,
          shipmentId: input.shipmentId ?? null,
          exchangeDate: input.exchangeDate,
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          fromAmount,
          rate,
          toAmount,
          commission,
          netAmount,
          settlementMode: input.settlementMode,
          remarks: input.remarks ?? null,
        },
        { userId: context.user.id },
        tx,
      );

      await ledgerService.post(
        {
          partyType: LedgerPartyType.MONEY_CHANGER,
          partyId: changer.id,
          partyName: changer.name,
          currencyCode: input.toCurrency,
          exchangeRate: 1,
          entryDate: input.exchangeDate,
          entryType: LedgerEntryType.EXCHANGE,
          referenceType: LedgerReferenceType.CURRENCY_EXCHANGE,
          referenceId: exchange.id,
          referenceNo,
          narration: `Converted ${fromAmount.toFixed(2)} ${input.fromCurrency} to ${netAmount.toFixed(2)} ${input.toCurrency} at ${rate.toFixed(6)}`,
          credit: netAmount,
          shipmentId: input.shipmentId ?? null,
          actorId: context.user.id,
        },
        tx,
      );

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: exchange.id,
          action: AuditAction.CREATE,
          summary: `Recorded exchange ${referenceNo}`,
        },
        tx,
      );

      return exchange;
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const exchange = await currencyExchangeRepository.requireById(id, {}, tx);

      await ledgerService.reverse(
        LedgerReferenceType.CURRENCY_EXCHANGE,
        exchange.id,
        `Reversal of exchange ${exchange.referenceNo}`,
        context.user.id,
        tx,
      );

      await currencyExchangeRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Reversed exchange ${exchange.referenceNo}`,
        },
        tx,
      );
    });
  }
}

export const moneyChangerService = new MoneyChangerService();
export const currencyExchangeService = new CurrencyExchangeService();
