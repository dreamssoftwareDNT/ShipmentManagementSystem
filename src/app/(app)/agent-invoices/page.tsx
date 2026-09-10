import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { AgentInvoiceModule } from '@/features/payables/agent-invoice-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Agent invoices' };

export default async function AgentInvoicesPage() {
  const user = await guardPage(AppModule.AGENT_INVOICES, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Clearing agent invoices"
        description="Clearance fees, customs duty and disbursements advanced by agents."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Agent invoices' }]}
      />

      <AgentInvoiceModule canCreate={access.can(AppModule.AGENT_INVOICES, PermissionAction.CREATE)} />
    </>
  );
}
