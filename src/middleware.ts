import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'importms.session';

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Edge level gate. It only proves the session cookie carries an unexpired,
 * untampered token; permission checks stay in the server layer where the user's
 * roles can be read from the database.
 */
async function hasValidToken(request: NextRequest): Promise<boolean> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return false;
  }

  const separator = raw.lastIndexOf('.');

  if (separator < 0) {
    return false;
  }

  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return false;
  }

  try {
    await jwtVerify(raw.slice(0, separator), new TextEncoder().encode(secret), {
      issuer: 'importms',
      audience: 'importms-web',
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = await hasValidToken(request);

  if (isPublic(pathname)) {
    if (authenticated && (pathname === '/login' || pathname === '/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication is required' } },
        { status: 401 },
      );
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
