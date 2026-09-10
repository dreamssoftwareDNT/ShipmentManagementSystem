import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { AuditLogList } from '@/features/admin/audit-log-list';
import { auditLogService } from '@/services/user.service';
import { guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  await guardPage(AppModule.AUDIT_LOGS, PermissionAction.READ);
  const entityNames = await auditLogService.entityNames();

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every create, change, approval and cancellation, with who did it."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Audit log' }]}
      />

      <AuditLogList entityNames={entityNames} />
    </>
  );
}
