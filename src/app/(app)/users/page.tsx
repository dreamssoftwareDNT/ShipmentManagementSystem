import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { UserModule } from '@/features/admin/user-module';
import { accessControl, guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const user = await guardPage(AppModule.USERS, PermissionAction.READ);
  const access = accessControl(user);

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts, role assignment and password administration."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
      />

      <UserModule
        permissions={{
          canCreate: access.can(AppModule.USERS, PermissionAction.CREATE),
          canUpdate: access.can(AppModule.USERS, PermissionAction.UPDATE),
          canDelete: access.can(AppModule.USERS, PermissionAction.DELETE),
        }}
      />
    </>
  );
}
