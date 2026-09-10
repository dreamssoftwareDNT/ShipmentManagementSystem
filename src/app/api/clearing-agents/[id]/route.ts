import { defineRoute } from '@/lib/http/api-handler';
import { clearingAgentService } from '@/services/clearing-agent.service';
import { updateClearingAgentSchema } from '@/schemas/partner.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.CLEARING_AGENTS,
  action: PermissionAction.READ,
  handle: ({ params }) => clearingAgentService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.CLEARING_AGENTS,
  action: PermissionAction.UPDATE,
  bodySchema: updateClearingAgentSchema,
  handle: ({ params, body, context }) =>
    clearingAgentService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.CLEARING_AGENTS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await clearingAgentService.remove(params.id as string, context);
    return { archived: true };
  },
});
