import type { Currency, CurrencyRate } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class CurrencyRepository extends BaseRepository<Currency> {
  protected readonly entityName = 'Currency';

  protected delegate(client: DatabaseClient): ModelDelegate<Currency> {
    return client.currency as unknown as ModelDelegate<Currency>;
  }

  async findByCode(code: string, client?: DatabaseClient): Promise<Currency | null> {
    return this.findOne({ code }, {}, client);
  }

  async listActive(client?: DatabaseClient): Promise<Currency[]> {
    return this.findAll({ isActive: true }, { orderBy: { code: 'asc' } }, client);
  }

  async findBase(client?: DatabaseClient): Promise<Currency | null> {
    return this.findOne({ isBase: true }, {}, client);
  }
}

export class CurrencyRateRepository extends BaseRepository<CurrencyRate> {
  protected readonly entityName = 'Currency rate';

  protected delegate(client: DatabaseClient): ModelDelegate<CurrencyRate> {
    return client.currencyRate as unknown as ModelDelegate<CurrencyRate>;
  }

  async findLatestRate(
    fromCurrencyId: string,
    toCurrencyId: string,
    asOf: Date,
    client?: DatabaseClient,
  ): Promise<CurrencyRate | null> {
    return this.findOne(
      { fromCurrencyId, toCurrencyId, effectiveFrom: { lte: asOf } },
      { orderBy: { effectiveFrom: 'desc' } },
      client,
    );
  }
}

export const currencyRepository = new CurrencyRepository();
export const currencyRateRepository = new CurrencyRateRepository();
