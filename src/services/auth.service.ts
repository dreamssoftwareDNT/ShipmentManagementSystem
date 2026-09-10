import { getEnv } from '@/config/env';
import {
  ForbiddenError,
  RateLimitError,
  UnauthenticatedError,
  ValidationError,
} from '@/lib/errors';
import { PasswordPolicy, passwordHasher } from '@/lib/security/password';
import { tokenService } from '@/lib/security/tokens';
import { userRepository, type UserWithAccess } from '@/repositories/user.repository';
import {
  loginAttemptRepository,
  passwordResetTokenRepository,
  sessionRepository,
} from '@/repositories/session.repository';
import { auditLogRepository } from '@/repositories/audit-log.repository';
import { AuditAction, UserStatus } from '@/types/enums';
import type { PermissionCode } from '@/config/permissions';
import type { AuthenticatedUser } from '@/types/common';

export interface LoginRequest {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface PasswordResetRequest {
  email: string;
  ipAddress?: string | null;
}

export interface PasswordResetConfirmation {
  token: string;
  newPassword: string;
}

const GENERIC_LOGIN_FAILURE = 'Email address or password is incorrect';

export class AuthService {
  async login(request: LoginRequest): Promise<LoginResult> {
    const env = getEnv();
    const email = request.email.trim().toLowerCase();

    const windowStart = new Date(Date.now() - env.AUTH_LOCKOUT_MINUTES * 60_000);
    const recentFailures = await loginAttemptRepository.countRecentFailures(email, windowStart);

    if (recentFailures >= env.AUTH_MAX_FAILED_ATTEMPTS) {
      throw new RateLimitError(
        `Too many failed attempts. Try again in ${env.AUTH_LOCKOUT_MINUTES} minutes.`,
      );
    }

    const user = await userRepository.findByEmail(email);

    if (!user) {
      await this.recordAttempt(email, null, false, 'UNKNOWN_EMAIL', request);
      throw new UnauthenticatedError(GENERIC_LOGIN_FAILURE);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAttempt(email, user.id, false, 'ACCOUNT_LOCKED', request);
      throw new RateLimitError('This account is temporarily locked. Contact an administrator.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.recordAttempt(email, user.id, false, 'INACTIVE_ACCOUNT', request);
      throw new ForbiddenError('This account is not active. Contact an administrator.');
    }

    const passwordMatches = await passwordHasher.verify(request.password, user.passwordHash);

    if (!passwordMatches) {
      const failures = user.failedAttempts + 1;
      const lockedUntil =
        failures >= env.AUTH_MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60_000)
          : null;

      await userRepository.registerFailedAttempt(user.id, lockedUntil);
      await this.recordAttempt(email, user.id, false, 'BAD_PASSWORD', request);
      throw new UnauthenticatedError(GENERIC_LOGIN_FAILURE);
    }

    await userRepository.registerSuccessfulLogin(user.id);
    await this.recordAttempt(email, user.id, true, null, request);

    const expiresAt = new Date(Date.now() + env.AUTH_SESSION_TTL_MINUTES * 60_000);
    const opaqueToken = tokenService.generateOpaqueToken();

    const session = await sessionRepository.create({
      userId: user.id,
      tokenHash: tokenService.fingerprint(opaqueToken),
      ipAddress: request.ipAddress ?? null,
      userAgent: request.userAgent?.slice(0, 400) ?? null,
      expiresAt,
    });

    const token = await tokenService.issueSessionToken(
      { userId: user.id, sessionId: session.id },
      expiresAt,
    );

    await auditLogRepository.record({
      entityName: 'User',
      entityId: user.id,
      action: AuditAction.LOGIN,
      summary: `${user.email} signed in`,
      userId: user.id,
      ipAddress: request.ipAddress ?? null,
    });

    return {
      token: `${token}.${opaqueToken}`,
      expiresAt,
      user: this.toAuthenticatedUser(user),
    };
  }

  async resolveSession(rawToken: string): Promise<AuthenticatedUser | null> {
    const separator = rawToken.lastIndexOf('.');

    if (separator < 0) {
      return null;
    }

    const jwt = rawToken.slice(0, separator);
    const opaqueToken = rawToken.slice(separator + 1);
    const claims = await tokenService.readSessionToken(jwt);

    if (!claims) {
      return null;
    }

    const session = await sessionRepository.findActive(
      claims.sessionId,
      tokenService.fingerprint(opaqueToken),
    );

    if (!session || session.userId !== claims.userId) {
      return null;
    }

    const user = await userRepository.findWithAccess(claims.userId);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return this.toAuthenticatedUser(user);
  }

  async logout(rawToken: string, actorId?: string): Promise<void> {
    const separator = rawToken.lastIndexOf('.');

    if (separator < 0) {
      return;
    }

    const claims = await tokenService.readSessionToken(rawToken.slice(0, separator));

    if (!claims) {
      return;
    }

    await sessionRepository.revoke(claims.sessionId);

    await auditLogRepository.record({
      entityName: 'User',
      entityId: claims.userId,
      action: AuditAction.LOGOUT,
      summary: 'Session ended',
      userId: actorId ?? claims.userId,
    });
  }

  /**
   * Always resolves so the endpoint cannot be used to enumerate accounts. The
   * reset token is returned only when a matching active user exists; delivery
   * is the caller's responsibility.
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<string | null> {
    const env = getEnv();
    const email = request.email.trim().toLowerCase();
    const user = await userRepository.findByEmail(email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    await passwordResetTokenRepository.invalidateForUser(user.id);

    const resetToken = tokenService.generateOpaqueToken(32);

    await passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: tokenService.fingerprint(resetToken),
      expiresAt: new Date(Date.now() + env.AUTH_PASSWORD_RESET_TTL_MINUTES * 60_000),
      requestIp: request.ipAddress ?? null,
    });

    return resetToken;
  }

  async confirmPasswordReset(request: PasswordResetConfirmation): Promise<void> {
    this.assertPasswordPolicy(request.newPassword);

    const record = await passwordResetTokenRepository.findUsable(
      tokenService.fingerprint(request.token),
    );

    if (!record) {
      throw new ValidationError('This reset link is invalid or has expired', {
        token: ['This reset link is invalid or has expired'],
      });
    }

    const passwordHash = await passwordHasher.hash(request.newPassword);

    await userRepository.update(
      record.userId,
      { passwordHash, passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null },
      { userId: record.userId },
    );

    await passwordResetTokenRepository.markUsed(record.id);
    await sessionRepository.revokeAllForUser(record.userId);

    await auditLogRepository.record({
      entityName: 'User',
      entityId: record.userId,
      action: AuditAction.PASSWORD_RESET,
      summary: 'Password reset completed',
      userId: record.userId,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    this.assertPasswordPolicy(newPassword);

    const user = await userRepository.requireById(userId);
    const matches = await passwordHasher.verify(currentPassword, user.passwordHash);

    if (!matches) {
      throw new ValidationError('Current password is incorrect', {
        currentPassword: ['Current password is incorrect'],
      });
    }

    const passwordHash = await passwordHasher.hash(newPassword);

    await userRepository.update(
      userId,
      { passwordHash, passwordChangedAt: new Date() },
      { userId },
    );

    await sessionRepository.revokeAllForUser(userId);
  }

  private assertPasswordPolicy(password: string): void {
    const violations = PasswordPolicy.validate(password);

    if (violations.length > 0) {
      throw new ValidationError('Password does not meet the security policy', {
        newPassword: violations.map((violation) => violation.message),
      });
    }
  }

  private async recordAttempt(
    email: string,
    userId: string | null,
    successful: boolean,
    reason: string | null,
    request: LoginRequest,
  ): Promise<void> {
    await loginAttemptRepository.record({
      email,
      userId,
      successful,
      reason,
      ipAddress: request.ipAddress ?? null,
      userAgent: request.userAgent?.slice(0, 400) ?? null,
    });
  }

  private toAuthenticatedUser(user: UserWithAccess): AuthenticatedUser {
    const permissions = new Set<string>();

    for (const assignment of user.roles) {
      for (const rolePermission of assignment.role.permissions) {
        permissions.add(rolePermission.permission.code);
      }
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: user.roles.map((assignment) => assignment.role.code),
      permissions: [...permissions] as PermissionCode[],
    };
  }
}

export const authService = new AuthService();
