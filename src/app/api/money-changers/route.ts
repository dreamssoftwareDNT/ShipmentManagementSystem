import { defineRoute } from '@/lib/http/api-handler';
import { moneyChangerService } from '@/services/money-changer.service';
import { createMoneyChangerSchema, partnerQuerySchema } from '@/schemas/partner.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.READ,
  querySchema: partnerQuerySchema,
  handle: ({ query }) => moneyChangerService.list(query),
});

export const POST = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.CREATE,
  bodySchema: createMoneyChangerSchema,
  status: 201,
  handle: ({ body, context }) => moneyChangerService.create(body, context),
});
