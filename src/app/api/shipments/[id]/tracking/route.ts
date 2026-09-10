import { defineRoute } from '@/lib/http/api-handler';
import { shipmentService } from '@/services/shipment.service';
import { trackingEventSchema } from '@/schemas/shipment.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.SHIPMENT_TRACKING,
  action: PermissionAction.CREATE,
  bodySchema: trackingEventSchema,
  status: 201,
  handle: async ({ params, body, context }) => {
    await shipmentService.addTrackingEvent(params.id as string, body, context);
    return { recorded: true };
  },
});
