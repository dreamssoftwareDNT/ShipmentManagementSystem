import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { CurrencyRateModule } from '@/features/partners/currency-rate-module';
import { currencyRepository } from '@/repositories/currency.repository';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Currency rates' };
export const dynamic = 'force-dynamic';

export default async function CurrencyRatesPage() {
  const user = await guardPage(AppModule.CURRENCY_RATES, PermissionAction.READ);
  const access = accessControl(user);
  const currencies = await currencyRepository.listActive();

  return (
    <>
      <PageHeader
        title="Currency rates"
        description="Effective dated rates used to convert foreign currency documents to base."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Currency rates' }]}
      />

      <CurrencyRateModule
        canCreate={access.can(AppModule.CURRENCY_RATES, PermissionAction.CREATE)}
        currencies={currencies.map((currency) => ({
          id: currency.id,
          code: currency.code,
          name: currency.name,
        }))}
      />
    </>
  );
}
