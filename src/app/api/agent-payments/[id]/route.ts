import { defineRoute } from '@/lib/http/api-handler';
import { agentPaymentService } from '@/services/agent-billing.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.AGENT_PAYMENTS,
  action: PermissionAction.READ,
  handle: ({ params }) => agentPaymentService.getDetail(params.id as string),
});
