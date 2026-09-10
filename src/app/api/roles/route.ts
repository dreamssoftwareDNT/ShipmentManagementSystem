import { defineRoute } from '@/lib/http/api-handler';
import { roleService } from '@/services/user.service';
import { roleSchema } from '@/schemas/user.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.ROLES,
  action: PermissionAction.READ,
  handle: () => roleService.list(),
});

export const POST = defineRoute({
  module: AppModule.ROLES,
  action: PermissionAction.CREATE,
  bodySchema: roleSchema,
  status: 201,
  handle: ({ body, context }) => roleService.create(body, context),
});
