import { defineRoute } from '@/lib/http/api-handler';
import { expenseService } from '@/services/expense.service';
import { createExpenseSchema } from '@/schemas/expense.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.READ,
  handle: ({ params }) => expenseService.getById(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.UPDATE,
  bodySchema: createExpenseSchema,
  handle: ({ params, body, context }) => expenseService.update(params.id as string, body, context),
});

export const DELETE = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await expenseService.remove(params.id as string, context);
    return { removed: true };
  },
});
