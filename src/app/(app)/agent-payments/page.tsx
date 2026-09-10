import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { PaymentList } from '@/features/payments/payment-list';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Agent payments' };

export default async function AgentPaymentsPage() {
  const user = await guardPage(AppModule.AGENT_PAYMENTS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Agent payments"
        description="Settlements against clearing agent invoices, duty and disbursements."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Agent payments' }]}
      />

      <PaymentList
        documentLabel="Payment"
        canCreate={access.can(AppModule.AGENT_PAYMENTS, PermissionAction.CREATE)}
        config={{
          endpoint: '/agent-payments',
          partyLabel: 'Clearing agent',
          partyOptionSet: 'clearingAgents',
          outstandingPath: (partyId) => `/clearing-agents/${partyId}/outstanding`,
          title: 'Record payment',
          description: 'Apply the amount paid across the agent open invoices.',
          successLabel: 'Payment recorded',
          showCheque: false,
        }}
      />
    </>
  );
}
