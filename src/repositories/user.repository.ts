import type { Prisma, User } from '@prisma/client';
import { BaseRepository, type ModelDelegate } from './base.repository';
import { resolveClient, type DatabaseClient } from '@/database/unit-of-work';

export const USER_WITH_ACCESS_INCLUDE = {
  roles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{
  include: typeof USER_WITH_ACCESS_INCLUDE;
}>;

export class UserRepository extends BaseRepository<User> {
  protected readonly entityName = 'User';

  protected delegate(client: DatabaseClient): ModelDelegate<User> {
    return client.user as unknown as ModelDelegate<User>;
  }

  buildSearchFilter(search?: string): Prisma.UserWhereInput {
    if (!search) {
      return {};
    }

    return {
      OR: [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { employeeCode: { contains: search } },
      ],
    };
  }

  async findByEmail(email: string, client?: DatabaseClient): Promise<UserWithAccess | null> {
    return resolveClient(client).user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: USER_WITH_ACCESS_INCLUDE,
    });
  }

  async findWithAccess(id: string, client?: DatabaseClient): Promise<UserWithAccess | null> {
    return resolveClient(client).user.findFirst({
      where: { id, deletedAt: null },
      include: USER_WITH_ACCESS_INCLUDE,
    });
  }

  async isEmailTaken(email: string, excludeId?: string, client?: DatabaseClient): Promise<boolean> {
    return this.exists(
      excludeId
        ? { email: email.toLowerCase(), id: { not: excludeId } }
        : { email: email.toLowerCase() },
      client,
    );
  }

  async replaceRoles(
    userId: string,
    roleIds: string[],
    actorId: string,
    client: DatabaseClient,
  ): Promise<void> {
    await client.userRole.deleteMany({ where: { userId } });

    if (roleIds.length > 0) {
      await client.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId, createdById: actorId })),
      });
    }
  }

  async registerFailedAttempt(
    userId: string,
    lockedUntil: Date | null,
    client?: DatabaseClient,
  ): Promise<void> {
    await resolveClient(client).user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 }, lockedUntil },
    });
  }

  async registerSuccessfulLogin(userId: string, client?: DatabaseClient): Promise<void> {
    await resolveClient(client).user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }
}

export const userRepository = new UserRepository();
