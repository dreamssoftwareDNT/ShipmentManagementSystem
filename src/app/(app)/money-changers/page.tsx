import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { MoneyChangerModule } from '@/features/partners/money-changer-module';
import { CurrencyExchangePanel } from '@/features/partners/currency-exchange-panel';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Money changers' };

export default async function MoneyChangersPage() {
  const user = await guardPage(AppModule.MONEY_CHANGERS, PermissionAction.READ);
  const access = accessControl(user);

  const permissions = {
    canCreate: access.can(AppModule.MONEY_CHANGERS, PermissionAction.CREATE),
    canUpdate: access.can(AppModule.MONEY_CHANGERS, PermissionAction.UPDATE),
    canDelete: access.can(AppModule.MONEY_CHANGERS, PermissionAction.DELETE),
  };

  return (
    <>
      <PageHeader
        title="Money changers"
        description="Counterparties and the currency conversions settled through them."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Money changers' }]}
      />

      <div className="space-y-4">
        <MoneyChangerModule permissions={permissions} />

        <div>
          <h2 className="mb-2 text-sm font-semibold text-ink">Currency exchanges</h2>
          <CurrencyExchangePanel canCreate={permissions.canCreate} />
        </div>
      </div>
    </>
  );
}
