import { defineRoute } from '@/lib/http/api-handler';
import { currencyExchangeService } from '@/services/money-changer.service';
import {
  createCurrencyExchangeSchema,
  currencyExchangeQuerySchema,
} from '@/schemas/partner.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.READ,
  querySchema: currencyExchangeQuerySchema,
  handle: ({ query }) => currencyExchangeService.list(query),
});

export const POST = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.CREATE,
  bodySchema: createCurrencyExchangeSchema,
  status: 201,
  handle: ({ body, context }) => currencyExchangeService.create(body, context),
});
