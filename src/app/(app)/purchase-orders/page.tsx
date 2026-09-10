import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { PurchaseOrderModule } from '@/features/purchase-orders/purchase-order-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Purchase orders' };

export default async function PurchaseOrdersPage() {
  const user = await guardPage(AppModule.PURCHASE_ORDERS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Committed spend with carriers and suppliers, approved before invoicing."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Purchase orders' }]}
      />

      <PurchaseOrderModule
        permissions={{
          canCreate: access.can(AppModule.PURCHASE_ORDERS, PermissionAction.CREATE),
          canUpdate: access.can(AppModule.PURCHASE_ORDERS, PermissionAction.UPDATE),
          canApprove: access.can(AppModule.PURCHASE_ORDERS, PermissionAction.APPROVE),
        }}
      />
    </>
  );
}
