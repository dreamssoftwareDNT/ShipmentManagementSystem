import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { authService } from '@/services/auth.service';
import { loginSchema } from '@/schemas/auth.schema';
import { handleRouteError } from '@/lib/http/api-handler';
import { writeSessionCookie } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const headerList = await headers();

    const result = await authService.login({
      email: payload.email,
      password: payload.password,
      ipAddress:
        headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        headerList.get('x-real-ip') ??
        null,
      userAgent: headerList.get('user-agent'),
    });

    await writeSessionCookie(result.token, result.expiresAt);

    return NextResponse.json({
      success: true,
      data: { user: result.user, expiresAt: result.expiresAt },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
