import { defineRoute } from '@/lib/http/api-handler';
import { roleService } from '@/services/user.service';
import { updateRoleSchema } from '@/schemas/user.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.ROLES,
  action: PermissionAction.READ,
  handle: ({ params }) => roleService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.ROLES,
  action: PermissionAction.UPDATE,
  bodySchema: updateRoleSchema,
  handle: ({ params, body, context }) => roleService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.ROLES,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await roleService.remove(params.id as string, context);
    return { removed: true };
  },
});
