import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { PaymentList } from '@/features/payments/payment-list';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Vendor payments' };

export default async function VendorPaymentsPage() {
  const user = await guardPage(AppModule.VENDOR_PAYMENTS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Vendor payments"
        description="Settlements against carrier and supplier invoices."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Vendor payments' }]}
      />

      <PaymentList
        documentLabel="Payment"
        canCreate={access.can(AppModule.VENDOR_PAYMENTS, PermissionAction.CREATE)}
        config={{
          endpoint: '/vendor-payments',
          partyLabel: 'Vendor',
          partyOptionSet: 'vendors',
          outstandingPath: (partyId) => `/vendors/${partyId}/outstanding`,
          title: 'Record payment',
          description: 'Apply the amount paid across the vendor open invoices.',
          successLabel: 'Payment recorded',
        }}
      />
    </>
  );
}
