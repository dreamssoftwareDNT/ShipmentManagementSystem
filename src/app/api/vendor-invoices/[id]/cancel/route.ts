import { defineRoute } from '@/lib/http/api-handler';
import { vendorInvoiceService } from '@/services/vendor-invoice.service';
import { cancelDocumentSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.DELETE,
  bodySchema: cancelDocumentSchema,
  handle: ({ params, body, context }) =>
    vendorInvoiceService.cancel(params.id as string, body, context),
});
