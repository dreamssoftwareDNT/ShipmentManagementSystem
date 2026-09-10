import { defineRoute } from '@/lib/http/api-handler';
import { purchaseOrderService } from '@/services/purchase-order.service';
import { createPurchaseOrderSchema, purchaseOrderQuerySchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.READ,
  querySchema: purchaseOrderQuerySchema,
  handle: ({ query }) => purchaseOrderService.list(query),
});

export const POST = defineRoute({
  module: AppModule.PURCHASE_ORDERS,
  action: PermissionAction.CREATE,
  bodySchema: createPurchaseOrderSchema,
  status: 201,
  handle: ({ body, context }) => purchaseOrderService.create(body, context),
});
