import { defineRoute } from '@/lib/http/api-handler';
import { agentInvoiceService } from '@/services/agent-billing.service';
import { cancelDocumentSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.AGENT_INVOICES,
  action: PermissionAction.DELETE,
  bodySchema: cancelDocumentSchema,
  handle: ({ params, body, context }) =>
    agentInvoiceService.cancel(params.id as string, body, context),
});
