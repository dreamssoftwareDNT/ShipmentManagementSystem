import { defineRoute } from '@/lib/http/api-handler';
import { vendorPaymentService } from '@/services/vendor-payment.service';
import { AppModule, PermissionAction } from '@/config/permissions';

export const GET = defineRoute({
  module: AppModule.VENDOR_PAYMENTS,
  action: PermissionAction.READ,
  handle: ({ params }) => vendorPaymentService.getDetail(params.id as string),
});
