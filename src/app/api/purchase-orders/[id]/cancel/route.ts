import { defineRoute } from '@/lib/http/api-handler';
import { purchaseOrderService } from '@/services/purchase-order.service';
import { cancelDocumentSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.UPDATE,
  bodySchema: cancelDocumentSchema,
  handle: ({ params, body, context }) =>
    purchaseOrderService.cancel(params.id as string, body, context),
});
