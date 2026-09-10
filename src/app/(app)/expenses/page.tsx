import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ExpenseModule } from '@/features/expenses/expense-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Expenses' };

export default async function ExpensesPage() {
  const user = await guardPage(AppModule.EXPENSES, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Operating cost by category, optionally charged to a shipment."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Expenses' }]}
      />

      <ExpenseModule
        permissions={{
          canCreate: access.can(AppModule.EXPENSES, PermissionAction.CREATE),
          canApprove: access.can(AppModule.EXPENSES, PermissionAction.APPROVE),
          canDelete: access.can(AppModule.EXPENSES, PermissionAction.DELETE),
        }}
      />
    </>
  );
}
