import { ForbiddenError } from '@/lib/errors';
import { AppModule, PermissionAction, permission } from '@/config/permissions';
import type { PermissionCode } from '@/config/permissions';
import { RoleCode } from '@/types/enums';
import type { AuthenticatedUser } from '@/types/common';

export class AccessControl {
  private readonly granted: ReadonlySet<string>;
  private readonly roles: ReadonlySet<string>;

  constructor(private readonly user: AuthenticatedUser) {
    this.granted = new Set(user.permissions);
    this.roles = new Set(user.roles);
  }

  isAdministrator(): boolean {
    return this.roles.has(RoleCode.ADMIN);
  }

  hasRole(role: RoleCode): boolean {
    return this.roles.has(role);
  }

  can(module: AppModule, action: PermissionAction): boolean {
    return this.isAdministrator() || this.granted.has(permission(module, action));
  }

  canAny(candidates: Array<[AppModule, PermissionAction]>): boolean {
    return candidates.some(([module, action]) => this.can(module, action));
  }

  canAccessModule(module: AppModule): boolean {
    return this.can(module, PermissionAction.READ);
  }

  assert(module: AppModule, action: PermissionAction): void {
    if (!this.can(module, action)) {
      throw new ForbiddenError(
        `Missing permission ${permission(module, action)} for user ${this.user.email}`,
      );
    }
  }

  permissions(): PermissionCode[] {
    return [...this.granted] as PermissionCode[];
  }
}

export function accessControlFor(user: AuthenticatedUser): AccessControl {
  return new AccessControl(user);
}
