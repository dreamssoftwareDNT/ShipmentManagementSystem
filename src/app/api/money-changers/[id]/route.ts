import { defineRoute } from '@/lib/http/api-handler';
import { moneyChangerService } from '@/services/money-changer.service';
import { updateMoneyChangerSchema } from '@/schemas/partner.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.READ,
  handle: ({ params }) => moneyChangerService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.UPDATE,
  bodySchema: updateMoneyChangerSchema,
  handle: ({ params, body, context }) =>
    moneyChangerService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.MONEY_CHANGERS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await moneyChangerService.remove(params.id as string, context);
    return { archived: true };
  },
});
