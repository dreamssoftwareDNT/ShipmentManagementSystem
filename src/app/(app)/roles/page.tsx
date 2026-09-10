import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { RoleMatrix } from '@/features/admin/role-matrix';
import { roleService } from '@/services/user.service';
import { guardPage } from '@/lib/auth/session';
import { AppModule, PermissionAction } from '@/config/permissions';

export const metadata: Metadata = { title: 'Roles' };
export const dynamic = 'force-dynamic';

export default async function RolesPage() {
  await guardPage(AppModule.ROLES, PermissionAction.READ);

  const roles = await roleService.list();
  const catalogue = roleService.permissionCatalogue();

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        description="What each role may do in each module."
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles' }]}
      />

      <RoleMatrix
        roles={roles.map((role) => ({
          id: role.id,
          code: role.code,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          userCount: role._count.users,
          permissionCodes: role.permissions.map((entry) => entry.permission.code),
        }))}
        permissions={catalogue.map((entry) => ({
          code: entry.code,
          module: entry.module,
          action: entry.action,
        }))}
      />
    </>
  );
}
