import { defineRoute } from '@/lib/http/api-handler';
import { currencyExchangeService } from '@/services/money-changer.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.READ,
  handle: ({ params }) => currencyExchangeService.getById(params.id as string),
});

export const DELETE = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await currencyExchangeService.remove(params.id as string, context);
    return { reversed: true };
  },
});
