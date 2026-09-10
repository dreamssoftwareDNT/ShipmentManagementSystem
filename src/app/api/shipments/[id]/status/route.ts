import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { changeShipmentStatusSchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.UPDATE,
  bodySchema: changeShipmentStatusSchema,
  handle: ({ params, body, context }) =>
    shipmentService.changeStatus(params.id as string, body, context),
});
