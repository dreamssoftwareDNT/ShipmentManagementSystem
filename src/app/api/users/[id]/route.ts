import { defineRoute } from '@/lib/http/api-handler';
import { userService } from '@/services/user.service';
import { updateUserSchema } from '@/schemas/user.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.READ,
  handle: ({ params }) => userService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.UPDATE,
  bodySchema: updateUserSchema,
  handle: ({ params, body, context }) => userService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await userService.remove(params.id as string, context);
    return { removed: true };
  },
});
