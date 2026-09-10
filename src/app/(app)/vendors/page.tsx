import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { VendorList } from '@/features/vendors/vendor-list';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Vendors' };

export default async function VendorsPage() {
  const user = await guardPage(AppModule.VENDORS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Carriers, hauliers, warehouses, insurers and other suppliers."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Vendors' }]}
      />

      <VendorList
        permissions={{
          canCreate: access.can(AppModule.VENDORS, PermissionAction.CREATE),
          canUpdate: access.can(AppModule.VENDORS, PermissionAction.UPDATE),
          canDelete: access.can(AppModule.VENDORS, PermissionAction.DELETE),
        }}
      />
    </>
  );
}
