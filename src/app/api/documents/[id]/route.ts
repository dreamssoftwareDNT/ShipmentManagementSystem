import { defineRoute } from '@/lib/http/api-handler';
import { documentService } from '@/services/document.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const DELETE = defineRoute({
  module: AppModule.SHIPMENT_DOCUMENTS,
  action: PermissionAction.DELETE,
  handle: async ({ params, context }) => {
    await documentService.remove(params.id as string, context);
    return { removed: true };
  },
});
