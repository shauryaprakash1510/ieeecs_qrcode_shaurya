import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Allow static assets, login route, and auth API
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('team_session');
  const validPasscode = process.env.TEAM_PASSCODE || 'event2026';

  if (!sessionCookie || sessionCookie.value !== validPasscode) {
    const loginUrl = new URL('/login', request.url);
    const target = pathname + (search || '');
    loginUrl.searchParams.set('redirect', target);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
