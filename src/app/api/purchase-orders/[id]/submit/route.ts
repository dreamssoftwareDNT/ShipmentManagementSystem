import { defineRoute } from '@/lib/http/api-handler';
import { purchaseOrderService } from '@/services/purchase-order.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.UPDATE,
  handle: ({ params, context }) =>
    purchaseOrderService.submitForApproval(params.id as string, context),
});
