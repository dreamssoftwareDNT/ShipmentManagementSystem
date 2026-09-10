import { defineRoute } from '@/lib/http/api-handler';
import { currencyRateRepository, currencyRepository } from '@/repositories/currency.repository';
import { upsertCurrencyRateSchema } from '@/schemas/partner.schema';
import { pageRequestSchema } from '@/schemas/common.schema';
import { UnitOfWork } from '@/database/unit-of-work';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.CURRENCY_RATES,
  action: PermissionAction.READ,
  querySchema: pageRequestSchema,
  handle: ({ query }) =>
    currencyRateRepository.paginate(
      {},
      {
        page: query.page,
        pageSize: query.pageSize,
        sortDirection: query.sortDirection,
        sortBy: query.sortBy,
      },
      {
        include: {
          fromCurrency: { select: { code: true, name: true } },
          toCurrency: { select: { code: true, name: true } },
        },
        orderBy: { effectiveFrom: 'desc' },
      },
    ),
});

export const POST = defineRoute({
  module: AppModule.CURRENCY_RATES,
  action: PermissionAction.CREATE,
  bodySchema: upsertCurrencyRateSchema,
  status: 201,
  handle: ({ body, context }) =>
    UnitOfWork.run(async (tx) => {
      await currencyRepository.requireById(body.fromCurrencyId, {}, tx);
      await currencyRepository.requireById(body.toCurrencyId, {}, tx);

      return currencyRateRepository.create(
        {
          fromCurrencyId: body.fromCurrencyId,
          toCurrencyId: body.toCurrencyId,
          rate: body.rate,
          effectiveFrom: body.effectiveFrom,
          source: body.source ?? null,
        },
        { userId: context.user.id },
        tx,
      );
    }),
});
