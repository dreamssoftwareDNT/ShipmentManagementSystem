import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { updateShipmentSchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.READ,
  handle: ({ params }) => shipmentService.getDetail(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.UPDATE,
  bodySchema: updateShipmentSchema,
  handle: ({ params, body, context }) => shipmentService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await shipmentService.remove(params.id as string, context);
    return { archived: true };
  },
});
