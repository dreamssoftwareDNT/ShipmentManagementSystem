import { defineRoute } from '@/lib/http/api-handler';
import { vendorInvoiceService } from '@/services/vendor-invoice.service';
import { createVendorInvoiceSchema, invoiceQuerySchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.READ,
  querySchema: invoiceQuerySchema,
  handle: ({ query }) => vendorInvoiceService.list(query),
});

export const POST = defineRoute({
  module: AppModule.VENDOR_INVOICES,
  action: PermissionAction.CREATE,
  bodySchema: createVendorInvoiceSchema,
  status: 201,
  handle: ({ body, context }) => vendorInvoiceService.create(body, context),
});
