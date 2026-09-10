import { defineRoute } from '@/lib/http/api-handler';
import { clearingAgentService } from '@/services/clearing-agent.service';
import { createClearingAgentSchema, partnerQuerySchema } from '@/schemas/partner.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.CLEARING_AGENTS,
  action: PermissionAction.READ,
  querySchema: partnerQuerySchema,
  handle: ({ query }) => clearingAgentService.list(query),
});

export const POST = defineRoute({
  module: AppModule.CLEARING_AGENTS,
  action: PermissionAction.CREATE,
  bodySchema: createClearingAgentSchema,
  status: 201,
  handle: ({ body, context }) => clearingAgentService.create(body, context),
});
