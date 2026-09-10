import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { createShipmentSchema, shipmentQuerySchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.READ,
  querySchema: shipmentQuerySchema,
  handle: ({ query }) => shipmentService.list(query),
});

export const POST = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.CREATE,
  bodySchema: createShipmentSchema,
  status: 201,
  handle: ({ body, context }) => shipmentService.create(body, context),
});
