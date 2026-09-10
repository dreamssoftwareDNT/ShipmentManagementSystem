import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/http/api-handler';

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json({ success: true, data: { user } });
  } catch (error) {
    return handleRouteError(error);
  }
}
