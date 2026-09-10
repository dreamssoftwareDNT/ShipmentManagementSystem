import { defineRoute } from '@/lib/http/api-handler';
import { auditLogService } from '@/services/user.service';
import { auditLogQuerySchema } from '@/schemas/user.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.AUDIT_LOGS,
  action: PermissionAction.READ,
  querySchema: auditLogQuerySchema,
  handle: ({ query }) => auditLogService.list(query),
});
