import { defineRoute } from '@/lib/http/api-handler';
import { vendorService } from '@/services/vendor.service';
import { updateVendorSchema } from '@/schemas/vendor.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDORS,
  action: PermissionAction.READ,
  handle: ({ params }) => vendorService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.VENDORS,
  action: PermissionAction.UPDATE,
  bodySchema: updateVendorSchema,
  handle: ({ params, body, context }) => vendorService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.VENDORS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await vendorService.remove(params.id as string, context);
    return { archived: true };
  },
});
