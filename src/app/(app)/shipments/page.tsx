import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ShipmentList } from '@/features/shipments/shipment-list';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Shipments' };

export default async function ShipmentsPage() {
  const user = await guardPage(AppModule.SHIPMENTS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Shipments"
        description="Every booking from draft through customs clearance to close."
        breadcrumbs={[{ label: 'Operations' }, { label: 'Shipments' }]}
      />

      <ShipmentList canCreate={access.can(AppModule.SHIPMENTS, PermissionAction.CREATE)} />
    </>
  );
}
