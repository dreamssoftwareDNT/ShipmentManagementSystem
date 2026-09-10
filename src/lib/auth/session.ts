import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { AccessControl } from '@/lib/security/access-control';
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors';
import { getEnv, isProduction } from '@/config/env';
import type { AppModule, PermissionAction } from '@/config/permissions';
import type { AuthenticatedUser, RequestContext } from '@/types/common';

export const SESSION_COOKIE = 'importms.session';

export interface SessionCookieOptions {
  maxAgeSeconds: number;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

/**
 * Resolved once per request. Server components and route handlers share the
 * same lookup rather than each hitting the session table.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return authService.resolveSession(token);
});

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthenticatedError();
  }

  return user;
}

export async function requestContext(): Promise<RequestContext> {
  const [user, headerList] = await Promise.all([requireUser(), headers()]);

  return {
    user,
    ipAddress:
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headerList.get('x-real-ip') ??
      null,
    userAgent: headerList.get('user-agent'),
  };
}

export async function requireAccess(
  module: AppModule,
  action: PermissionAction,
): Promise<AuthenticatedUser> {
  const user = await requireUser();
  new AccessControl(user).assert(module, action);

  return user;
}

/**
 * Page level guard. Unlike requireAccess it redirects instead of throwing, so
 * an unauthorised navigation lands somewhere useful.
 */
export async function guardPage(
  module: AppModule,
  action: PermissionAction,
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!new AccessControl(user).can(module, action)) {
    redirect('/forbidden');
  }

  return user;
}

export function accessControl(user: AuthenticatedUser): AccessControl {
  return new AccessControl(user);
}

export function sessionMaxAgeSeconds(): number {
  return getEnv().AUTH_SESSION_TTL_MINUTES * 60;
}

export function assertPermission(user: AuthenticatedUser, module: AppModule, action: PermissionAction): void {
  if (!new AccessControl(user).can(module, action)) {
    throw new ForbiddenError();
  }
}
