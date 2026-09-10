import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { shipmentChargeSchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.UPDATE,
  bodySchema: shipmentChargeSchema,
  status: 201,
  handle: ({ params, body, context }) =>
    shipmentService.addCharge(params.id as string, body, context),
});
