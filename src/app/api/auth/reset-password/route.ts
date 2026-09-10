import { NextResponse } from 'next/server';
import { authService } from '@/services/auth.service';
import { resetPasswordSchema } from '@/schemas/auth.schema';
import { handleRouteError } from '@/lib/http/api-handler';

export async function POST(request: Request) {
  try {
    const payload = resetPasswordSchema.parse(await request.json());

    await authService.confirmPasswordReset({
      token: payload.token,
      newPassword: payload.newPassword,
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Your password has been updated. Please sign in.' },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
