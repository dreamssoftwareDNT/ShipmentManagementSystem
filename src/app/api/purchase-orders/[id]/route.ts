import { defineRoute } from '@/lib/http/api-handler';
import { purchaseOrderService } from '@/services/purchase-order.service';
import { createPurchaseOrderSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.READ,
  handle: ({ params }) => purchaseOrderService.getDetail(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.UPDATE,
  bodySchema: createPurchaseOrderSchema,
  handle: ({ params, body, context }) =>
    purchaseOrderService.update(params.id as string, body, context),
});
