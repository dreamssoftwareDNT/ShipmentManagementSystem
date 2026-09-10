import { defineRoute } from '@/lib/http/api-handler';
import { agentPaymentService } from '@/services/agent-billing.service';
import { cancelDocumentSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.AGENT_PAYMENTS,
  action: PermissionAction.DELETE,
  bodySchema: cancelDocumentSchema,
  handle: ({ params, body, context }) =>
    agentPaymentService.cancel(params.id as string, body, context),
});
