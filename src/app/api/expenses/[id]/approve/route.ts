import { defineRoute } from '@/lib/http/api-handler';
import { expenseService } from '@/services/expense.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.EXPENSES,
  action: PermissionAction.APPROVE,
  handle: ({ params, context }) => expenseService.approve(params.id as string, context),
});
