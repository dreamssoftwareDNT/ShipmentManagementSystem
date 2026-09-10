import { defineRoute } from '@/lib/http/api-handler';
import { agentInvoiceService } from '@/services/agent-billing.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.AGENT_INVOICES,
  action: PermissionAction.READ,
  handle: ({ params }) => agentInvoiceService.getDetail(params.id as string),
});
