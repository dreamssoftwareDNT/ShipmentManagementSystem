import { defineRoute } from '@/lib/http/api-handler';
import { agentPaymentService } from '@/services/agent-billing.service';
import { createPaymentSchema, paymentQuerySchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.AGENT_PAYMENTS,
  action: PermissionAction.READ,
  querySchema: paymentQuerySchema,
  handle: ({ query }) => agentPaymentService.list(query),
});

export const POST = defineRoute({
  module: AppModule.AGENT_PAYMENTS,
  action: PermissionAction.CREATE,
  bodySchema: createPaymentSchema,
  status: 201,
  handle: ({ body, context }) => agentPaymentService.create(body, context),
});
