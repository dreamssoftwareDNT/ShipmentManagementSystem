import type { CurrencyExchange, MoneyChanger, Prisma } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import type { DatabaseClient } from '@/database/unit-of-work';

export class MoneyChangerRepository extends BaseRepository<MoneyChanger> {
  protected readonly entityName = 'Money changer';

  protected delegate(client: DatabaseClient): ModelDelegate<MoneyChanger> {
    return client.moneyChanger as unknown as ModelDelegate<MoneyChanger>;
  }

  buildSearchFilter(search?: string): Prisma.MoneyChangerWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { companyName: { contains: search } },
        { licenseNumber: { contains: search } },
      ],
    };
  }

  async isCodeTaken(code: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(excludeId ? { code, id: { not: excludeId } } : { code }, client);
  }
}

export class CurrencyExchangeRepository extends BaseRepository<CurrencyExchange> {
  protected readonly entityName = 'Currency exchange';

  protected delegate(client: DatabaseClient): ModelDelegate<CurrencyExchange> {
    return client.currencyExchange as unknown as ModelDelegate<CurrencyExchange>;
  }

  buildSearchFilter(search?: string): Prisma.CurrencyExchangeWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { referenceNo: { contains: search } },
        { fromCurrency: { contains: search } },
        { toCurrency: { contains: search } },
        { moneyChanger: { name: { contains: search } } },
      ],
    };
  }
}

export const moneyChangerRepository = new MoneyChangerRepository();
export const currencyExchangeRepository = new CurrencyExchangeRepository();
