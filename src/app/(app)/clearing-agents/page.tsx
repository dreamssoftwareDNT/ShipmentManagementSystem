import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ClearingAgentModule } from '@/features/partners/clearing-agent-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Clearing agents' };

export default async function ClearingAgentsPage() {
  const user = await guardPage(AppModule.CLEARING_AGENTS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Clearing agents"
        description="Customs brokers handling clearance, duty and delivery orders by port."
        breadcrumbs={[{ label: 'Procurement' }, { label: 'Clearing agents' }]}
      />

      <ClearingAgentModule
        permissions={{
          canCreate: access.can(AppModule.CLEARING_AGENTS, PermissionAction.CREATE),
          canUpdate: access.can(AppModule.CLEARING_AGENTS, PermissionAction.UPDATE),
          canDelete: access.can(AppModule.CLEARING_AGENTS, PermissionAction.DELETE),
        }}
      />
    </>
  );
}
