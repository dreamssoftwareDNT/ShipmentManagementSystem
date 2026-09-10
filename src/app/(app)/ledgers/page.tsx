import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingPanel } from '@/components/ui/spinner';
import { LedgerViewer } from '@/features/ledgers/ledger-viewer';
import { guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Ledgers' };

export default async function LedgersPage({
  searchParams,
}: {
  searchParams: Promise<{ partyType?: string; partyId?: string }>;
}) {
  await guardPage(AppModule.LEDGERS, PermissionAction.READ);
  const { partyType, partyId } = await searchParams;

  return (
    <>
      <PageHeader
        title="Party ledgers"
        description="Append only statements for customers, vendors, clearing agents and money changers."
        breadcrumbs={[{ label: 'Finance' }, { label: 'Ledgers' }]}
      />

      <Suspense fallback={<LoadingPanel />}>
        <LedgerViewer initialPartyType={partyType} initialPartyId={partyId} />
      </Suspense>
    </>
  );
}
