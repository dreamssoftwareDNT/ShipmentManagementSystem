import { z } from 'zod';
import { defineRoute } from '@/lib/http/api-handler';
import { userService } from '@/services/user.service';
import { AppModule, PermissionAction } from '@/config/permissions';

const bodySchema = z.object({
  newPassword: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

export const POST = defineRoute({
  module: AppModule.USERS,
  action: PermissionAction.UPDATE,
  bodySchema,
  handle: async ({ params, body, context }) => {
    await userService.resetPassword(params.id as string, body.newPassword, context);
    return { reset: true };
  },
});
