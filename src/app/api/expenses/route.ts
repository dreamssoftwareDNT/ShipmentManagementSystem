import { defineRoute } from '@/lib/http/api-handler';
import { expenseService } from '@/services/expense.service';
import { createExpenseSchema, expenseQuerySchema } from '@/schemas/expense.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.READ,
  querySchema: expenseQuerySchema,
  handle: ({ query }) => expenseService.list(query),
});

export const POST = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.CREATE,
  bodySchema: createExpenseSchema,
  status: 201,
  handle: ({ body, context }) => expenseService.create(body, context),
});
