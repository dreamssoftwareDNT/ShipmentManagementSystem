import type { Prisma, User } from '@prisma/client';
import { BaseService } from './base.service';
import { userRepository, type UserWithAccess } from '@/repositories/user.repository';
import { roleRepository, type RoleWithPermissions } from '@/repositories/role.repository';
import { sessionRepository } from '@/repositories/session.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { prisma } from '@/database/prisma';
import { UnitOfWork } from '@/database/unit-of-work';
import { PasswordPolicy, passwordHasher } from '@/lib/security/password';
import { BusinessRuleError, ValidationError } from '@/lib/errors';
import { PERMISSION_CATALOGUE } from '@/config/permissions';
import { AuditAction, RoleCode, UserStatus } from '@/types/enums';
import type {
  AuditLogQueryInput,
  CreateUserInput,
  RoleInput,
  UpdateRoleInput,
  UpdateUserInput,
  UserQueryInput,
} from '@/schemas/user.schema';
import type { PageResult, RequestContext, SelectOption } from '@/types/common';

export class UserService extends BaseService {
  private readonly entityName = 'User';

  async list(query: UserQueryInput): Promise<PageResult<User>> {
    const page = this.normalizePage(query);

    const where: Prisma.UserWhereInput = {
      ...userRepository.buildSearchFilter(page.search),
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleId ? { roles: { some: { roleId: query.roleId } } } : {}),
    };

    return userRepository.paginate(where, page, {
      include: { roles: { include: { role: { select: { id: true, code: true, name: true } } } } },
      orderBy: page.sortBy ? { [page.sortBy]: page.sortDirection } : { fullName: 'asc' },
    });
  }

  async getById(id: string): Promise<UserWithAccess> {
    const user = await userRepository.findWithAccess(id);

    if (!user) {
      await userRepository.requireById(id);
      throw new BusinessRuleError('User access could not be resolved');
    }

    return user;
  }

  async create(input: CreateUserInput, context: RequestContext): Promise<User> {
    const violations = PasswordPolicy.validate(input.password);

    if (violations.length > 0) {
      throw new ValidationError('Password does not meet the security policy', {
        password: violations.map((violation) => violation.message),
      });
    }

    return UnitOfWork.run(async (tx) => {
      this.assertUnique(
        await userRepository.isEmailTaken(input.email, undefined, tx),
        'email',
        `${input.email} is already registered`,
      );

      await this.assertRolesExist(input.roleIds, tx);

      const user = await userRepository.create(
        {
          fullName: input.fullName,
          email: input.email,
          employeeCode: input.employeeCode ?? null,
          phone: input.phone ?? null,
          passwordHash: await passwordHasher.hash(input.password),
          status: input.status,
          passwordChangedAt: new Date(),
        },
        { userId: context.user.id },
        tx,
      );

      await userRepository.replaceRoles(user.id, input.roleIds, context.user.id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: user.id,
          action: AuditAction.CREATE,
          summary: `Created user ${user.email}`,
        },
        tx,
      );

      return user;
    });
  }

  async update(id: string, input: UpdateUserInput, context: RequestContext): Promise<User> {
    return UnitOfWork.run(async (tx) => {
      const existing = await userRepository.requireById(id, {}, tx);

      if (existing.isSystemAccount && input.status !== UserStatus.ACTIVE) {
        throw new BusinessRuleError('The built in system account cannot be deactivated');
      }

      this.assertUnique(
        await userRepository.isEmailTaken(input.email, id, tx),
        'email',
        `${input.email} is already registered`,
      );

      await this.assertRolesExist(input.roleIds, tx);
      await this.assertAdministratorRemains(id, input.roleIds, input.status, tx);

      const updated = await userRepository.update(
        id,
        {
          fullName: input.fullName,
          email: input.email,
          employeeCode: input.employeeCode ?? null,
          phone: input.phone ?? null,
          status: input.status,
        },
        { userId: context.user.id },
        tx,
      );

      await userRepository.replaceRoles(id, input.roleIds, context.user.id, tx);

      if (input.status !== UserStatus.ACTIVE) {
        await sessionRepository.revokeAllForUser(id, tx);
      }

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated user ${updated.email}`,
          changes: this.diff(
            existing as unknown as Record<string, unknown>,
            input as unknown as Record<string, unknown>,
          ),
        },
        tx,
      );

      return updated;
    });
  }

  async resetPassword(id: string, newPassword: string, context: RequestContext): Promise<void> {
    const violations = PasswordPolicy.validate(newPassword);

    if (violations.length > 0) {
      throw new ValidationError('Password does not meet the security policy', {
        newPassword: violations.map((violation) => violation.message),
      });
    }

    await UnitOfWork.run(async (tx) => {
      const user = await userRepository.requireById(id, {}, tx);

      await userRepository.update(
        id,
        {
          passwordHash: await passwordHasher.hash(newPassword),
          passwordChangedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
        },
        { userId: context.user.id },
        tx,
      );

      await sessionRepository.revokeAllForUser(id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.PASSWORD_RESET,
          summary: `Administrator reset the password for ${user.email}`,
        },
        tx,
      );
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const user = await userRepository.requireById(id, {}, tx);

      if (user.isSystemAccount) {
        throw new BusinessRuleError('The built in system account cannot be removed');
      }

      if (user.id === context.user.id) {
        throw new BusinessRuleError('You cannot remove your own account');
      }

      await this.assertAdministratorRemains(id, [], UserStatus.INACTIVE, tx);
      await userRepository.softDelete(id, { userId: context.user.id }, tx);
      await sessionRepository.revokeAllForUser(id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Removed user ${user.email}`,
        },
        tx,
      );
    });
  }

  private async assertRolesExist(roleIds: string[], tx: Prisma.TransactionClient): Promise<void> {
    const found = await tx.role.count({ where: { id: { in: roleIds }, deletedAt: null } });

    if (found !== roleIds.length) {
      throw new ValidationError('One or more selected roles no longer exist', {
        roleIds: ['One or more selected roles no longer exist'],
      });
    }
  }

  /**
   * Prevents the last administrator from being demoted or disabled, which
   * would otherwise lock everyone out of user administration.
   */
  private async assertAdministratorRemains(
    userId: string,
    nextRoleIds: string[],
    nextStatus: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const adminRole = await tx.role.findFirst({ where: { code: RoleCode.ADMIN, deletedAt: null } });

    if (!adminRole) {
      return;
    }

    const keepsAdmin = nextRoleIds.includes(adminRole.id) && nextStatus === UserStatus.ACTIVE;

    if (keepsAdmin) {
      return;
    }

    const otherActiveAdmins = await tx.user.count({
      where: {
        id: { not: userId },
        deletedAt: null,
        status: UserStatus.ACTIVE,
        roles: { some: { roleId: adminRole.id } },
      },
    });

    if (otherActiveAdmins === 0) {
      throw new BusinessRuleError(
        'At least one active administrator must remain in the system',
      );
    }
  }

  async history(id: string) {
    return auditLogRepository.listForEntity(this.entityName, id);
  }
}

export class RoleService extends BaseService {
  private readonly entityName = 'Role';

  async list(): Promise<RoleWithPermissions[]> {
    return roleRepository.listWithPermissions();
  }

  async getById(id: string): Promise<RoleWithPermissions> {
    const role = await roleRepository.findWithPermissions(id);

    if (!role) {
      await roleRepository.requireById(id);
      throw new BusinessRuleError('Role could not be resolved');
    }

    return role;
  }

  async options(): Promise<SelectOption[]> {
    const roles = await roleRepository.findAll({}, { orderBy: { name: 'asc' } });

    return roles.map((role) => ({ value: role.id, label: role.name, hint: role.code }));
  }

  permissionCatalogue() {
    return PERMISSION_CATALOGUE;
  }

  async create(input: RoleInput, context: RequestContext) {
    return UnitOfWork.run(async (tx) => {
      const existing = await roleRepository.findByCode(input.code, tx);

      if (existing) {
        throw new ValidationError(`Role code ${input.code} is already in use`, {
          code: [`Role code ${input.code} is already in use`],
        });
      }

      const role = await roleRepository.create(
        { code: input.code, name: input.name, description: input.description ?? null },
        { userId: context.user.id },
        tx,
      );

      await this.syncPermissions(role.id, input.permissionCodes, context.user.id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: role.id,
          action: AuditAction.CREATE,
          summary: `Created role ${role.code}`,
        },
        tx,
      );

      return role;
    });
  }

  async update(id: string, input: UpdateRoleInput, context: RequestContext) {
    return UnitOfWork.run(async (tx) => {
      const role = await roleRepository.requireById(id, {}, tx);

      if (role.code === RoleCode.ADMIN) {
        throw new BusinessRuleError('The administrator role always holds every permission');
      }

      const updated = await roleRepository.update(
        id,
        { name: input.name, description: input.description ?? null },
        { userId: context.user.id },
        tx,
      );

      await this.syncPermissions(id, input.permissionCodes, context.user.id, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.UPDATE,
          summary: `Updated role ${role.code}`,
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, context: RequestContext): Promise<void> {
    await UnitOfWork.run(async (tx) => {
      const role = await roleRepository.requireById(id, {}, tx);

      if (role.isSystem) {
        throw new BusinessRuleError(`${role.name} is a built in role and cannot be removed`);
      }

      const assigned = await tx.userRole.count({ where: { roleId: id } });

      if (assigned > 0) {
        throw new BusinessRuleError(
          `${role.name} is assigned to ${assigned} user(s) and cannot be removed`,
        );
      }

      await roleRepository.softDelete(id, { userId: context.user.id }, tx);

      await this.writeAudit(
        context,
        {
          entityName: this.entityName,
          entityId: id,
          action: AuditAction.DELETE,
          summary: `Removed role ${role.code}`,
        },
        tx,
      );
    });
  }

  private async syncPermissions(
    roleId: string,
    permissionCodes: string[],
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const permissions = await tx.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });

    await roleRepository.replacePermissions(
      roleId,
      permissions.map((permission) => permission.id),
      actorId,
      tx,
    );
  }
}

export class AuditLogService extends BaseService {
  async list(query: AuditLogQueryInput) {
    const page = this.normalizePage(query);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityName ? { entityName: query.entityName } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(page.search
        ? {
            OR: [
              { summary: { contains: page.search } },
              { entityId: { contains: page.search } },
            ],
          }
        : {}),
    };

    return auditLogRepository.paginate(where, page);
  }

  async entityNames(): Promise<string[]> {
    const rows = await prisma.auditLog.groupBy({ by: ['entityName'] });

    return rows.map((row) => row.entityName).sort();
  }
}

export const userService = new UserService();
export const roleService = new RoleService();
export const auditLogService = new AuditLogService();
