// In Next.js 16, middleware.ts has been renamed to proxy.ts
// The exported function must be named 'proxy' (not 'middleware')
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('skyvoice_token')?.value;
  const role  = request.cookies.get('skyvoice_role')?.value;

  // /register is not a real page — signup lives on /login
  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Root path — route based on auth (desktop entry point)
  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.redirect(
      new URL(role === 'admin' ? '/dashboard' : '/voice', request.url)
    );
  }

  // Already authenticated users skip login
  if (pathname === '/login') {
    if (token) {
      return NextResponse.redirect(
        new URL(role === 'admin' ? '/dashboard' : '/voice', request.url)
      );
    }
    return NextResponse.next();
  }

  // Dashboard routes — admin only, must be logged in
  if (pathname.startsWith('/dashboard')) {
    if (!token) return NextResponse.redirect(new URL('/login', request.url));
    if (role !== 'admin') return NextResponse.redirect(new URL('/voice', request.url));
  }

  // Reservations — requires auth, but /voice is public (no guard here)

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
