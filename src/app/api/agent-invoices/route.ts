import { defineRoute } from '@/lib/http/api-handler';
import { agentInvoiceService } from '@/services/agent-billing.service';
import { createAgentInvoiceSchema, invoiceQuerySchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.AGENT_INVOICES,
  action: PermissionAction.READ,
  querySchema: invoiceQuerySchema,
  handle: ({ query }) => agentInvoiceService.list(query),
});

export const POST = defineRoute({
  module: AppModule.AGENT_INVOICES,
  action: PermissionAction.CREATE,
  bodySchema: createAgentInvoiceSchema,
  status: 201,
  handle: ({ body, context }) => agentInvoiceService.create(body, context),
});
