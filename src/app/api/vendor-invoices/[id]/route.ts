import { defineRoute } from '@/lib/http/api-handler';
import { vendorInvoiceService } from '@/services/vendor-invoice.service';
import { createVendorInvoiceSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.READ,
  handle: ({ params }) => vendorInvoiceService.getDetail(params.id as string),
});

export const PUT = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.UPDATE,
  bodySchema: createVendorInvoiceSchema,
  handle: ({ params, body, context }) =>
    vendorInvoiceService.update(params.id as string, body, context),
});
