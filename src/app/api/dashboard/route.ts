import { defineRoute } from '@/lib/http/api-handler';
import { dashboardService } from '@/services/dashboard.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.DASHBOARD,
  action: PermissionAction.READ,
  handle: () => dashboardService.snapshot(),
});
