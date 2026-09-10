import { defineRoute } from '@/lib/http/api-handler';
import { vendorPaymentService } from '@/services/vendor-payment.service';
import { createPaymentSchema, paymentQuerySchema } from '@/schemas/billing.schema';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDOR_PAYMENTS,
  action: PermissionAction.READ,
  querySchema: paymentQuerySchema,
  handle: ({ query }) => vendorPaymentService.list(query),
});

export const POST = defineRoute({
  module: AppModule.VENDOR_PAYMENTS,
  action: PermissionAction.CREATE,
  bodySchema: createPaymentSchema,
  status: 201,
  handle: ({ body, context }) => vendorPaymentService.create(body, context),
});
