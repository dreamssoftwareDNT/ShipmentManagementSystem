import { defineRoute } from '@/lib/http/api-handler';
import { vendorInvoiceService } from '@/services/vendor-invoice.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.READ,
  handle: ({ params }) => vendorInvoiceService.outstandingForVendor(params.id as string),
});
