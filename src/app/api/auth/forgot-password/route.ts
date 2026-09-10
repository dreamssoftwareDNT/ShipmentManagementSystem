import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { authService } from '@/services/auth.service';
import { forgotPasswordSchema } from '@/schemas/auth.schema';
import { handleRouteError } from '@/lib/http/api-handler';
import { isProduction } from '@/config/env';

/**
 * Responds identically whether or not the address is registered. In a
 * non production environment the reset token is echoed back so the flow can be
 * exercised without an outbound mail service.
 */
export async function POST(request: Request) {
  try {
    const payload = forgotPasswordSchema.parse(await request.json());
    const headerList = await headers();

    const token = await authService.requestPasswordReset({
      email: payload.email,
      ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'If that address is registered, a reset link is on its way.',
        ...(isProduction() ? {} : { developmentToken: token }),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
