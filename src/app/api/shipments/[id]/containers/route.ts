import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { shipmentContainerSchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.SHIPMENTS,
  action: PermissionAction.UPDATE,
  bodySchema: shipmentContainerSchema,
  status: 201,
  handle: async ({ params, body, context }) => {
    await shipmentService.addContainer(params.id as string, body, context);
    return { added: true };
  },
});
