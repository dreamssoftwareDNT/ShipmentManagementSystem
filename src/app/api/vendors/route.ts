import { defineRoute } from '@/lib/http/api-handler';
import { vendorService } from '@/services/vendor.service';
import { createVendorSchema, vendorQuerySchema } from '@/schemas/vendor.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDORS,
  action: PermissionAction.READ,
  querySchema: vendorQuerySchema,
  handle: ({ query }) => vendorService.list(query),
});

export const POST = defineRoute({
  module: AppModule.VENDORS,
  action: PermissionAction.CREATE,
  bodySchema: createVendorSchema,
  status: 201,
  handle: ({ body, context }) => vendorService.create(body, context),
});
