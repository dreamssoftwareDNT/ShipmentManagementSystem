import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { VendorInvoiceModule } from '@/features/payables/vendor-invoice-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Vendor invoices' };

export default async function VendorInvoicesPage() {
  const user = await guardPage(AppModule.VENDOR_INVOICES, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Vendor invoices"
        description="Carrier, haulage and handling bills posted against shipments."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Vendor invoices' }]}
      />

      <VendorInvoiceModule canCreate={access.can(AppModule.VENDOR_INVOICES, PermissionAction.CREATE)} />
    </>
  );
}
