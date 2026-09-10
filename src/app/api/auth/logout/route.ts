import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authService } from '@/services/auth.service';
import { SESSION_COOKIE, clearSessionCookie } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/http/api-handler';

export async function POST() {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;

    if (token) {
      await authService.logout(token);
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true, data: { signedOut: true } });
  } catch (error) {
    return handleRouteError(error);
  }
}
