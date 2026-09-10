import type { Prisma, Role } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const ROLE_WITH_PERMISSIONS_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

export type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof ROLE_WITH_PERMISSIONS_INCLUDE;
}>;

export class RoleRepository extends BaseRepository<Role> {
  protected readonly entityName = 'Role';

  protected delegate(client: DatabaseClient): ModelDelegate<Role> {
    return client.role as unknown as ModelDelegate<Role>;
  }

  async findByCode(code: string, client?: DatabaseClient): Promise<Role | null> {
    return this.findOne({ code }, {}, client);
  }

  async listWithPermissions(client?: DatabaseClient): Promise<RoleWithPermissions[]> {
    return resolveClient(client).role.findMany({
      where: { deletedAt: null },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findWithPermissions(id: string, client?: DatabaseClient): Promise<RoleWithPermissions | null> {
    return resolveClient(client).role.findFirst({
      where: { id, deletedAt: null },
      include: ROLE_WITH_PERMISSIONS_INCLUDE,
    });
  }

  async replacePermissions(
    roleId: string,
    permissionIds: string[],
    actorId: string,
    client: DatabaseClient,
  ): Promise<void> {
    await client.rolePermission.deleteMany({ where: { roleId } });

    if (permissionIds.length > 0) {
      await client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId, createdById: actorId })),
      });
    }
  }
}

export const roleRepository = new RoleRepository();
