import { defineRoute } from '@/lib/http/api-handler';
import { vendorPaymentService } from '@/services/vendor-payment.service';
import { cancelDocumentSchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const POST = defineRoute({
  module: AppModule.VENDOR_PAYMENTS,
  action: PermissionAction.DELETE,
  bodySchema: cancelDocumentSchema,
  handle: ({ params, body, context }) =>
    vendorPaymentService.cancel(params.id as string, body, context),
});
