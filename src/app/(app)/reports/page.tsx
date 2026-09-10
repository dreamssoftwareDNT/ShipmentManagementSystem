import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ReportWorkspace } from '@/features/reports/report-workspace';
import { REPORT_CATALOGUE } from '@/services/report.service';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const user = await guardPage(AppModule.REPORTS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational and financial reporting with CSV export."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Reports' }]}
      />

      <ReportWorkspace
        reports={REPORT_CATALOGUE}
        canExport={access.can(AppModule.REPORTS, PermissionAction.EXPORT)}
      />
    </>
  );
}
