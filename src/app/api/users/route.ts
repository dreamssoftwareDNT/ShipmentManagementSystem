import { defineRoute } from '@/lib/http/api-handler';
import { userService } from '@/services/user.service';
import { createUserSchema, userQuerySchema } from '@/schemas/user.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.READ,
  querySchema: userQuerySchema,
  handle: ({ query }) => userService.list(query),
});

export const POST = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.CREATE,
  bodySchema: createUserSchema,
  status: 201,
  handle: ({ body, context }) => userService.create(body, context),
});
