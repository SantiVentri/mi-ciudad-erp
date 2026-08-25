import { NextResponse, type NextRequest } from 'next/server'
import { createProxyClient } from './utils/supabase/middleware'

const PUBLIC_PATHS = ['/login', '/invite'];

const ROLE_CONFIG: Record<string, { home: string; ownedPrefixes: string[] }> = {
  admin: { home: '/admin', ownedPrefixes: ['/admin'] },
  driver: { home: '/driver', ownedPrefixes: ['/driver'] },
};
const DEFAULT_HOME = '/login';

function getHomeForRole(role: string | undefined) {
  return (role && ROLE_CONFIG[role]?.home) ?? DEFAULT_HOME;
}

function isPathOwnedByOtherRole(path: string, role: string | undefined) {
  return Object.entries(ROLE_CONFIG).some(([roleKey, config]) => {
    if (roleKey === role) return false;
    return config.ownedPrefixes.some((p) => path === p || path.startsWith(`${p}/`));
  });
}

function redirectPreservingSession(request: NextRequest, sessionResponse: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirectResponse = NextResponse.redirect(url)
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })
  return redirectResponse
}

export async function proxy(request: NextRequest) {
  const { supabase, ref } = createProxyClient(request)

  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role as string | undefined;

  const path = request.nextUrl.pathname
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (!user && !isPublicPath && path !== '/') {
    return redirectPreservingSession(request, ref.response, '/login')
  }

  if (user && (path === '/login' || path === '/')) {
    return redirectPreservingSession(request, ref.response, getHomeForRole(role))
  }

  if (user && isPathOwnedByOtherRole(path, role)) {
    return redirectPreservingSession(request, ref.response, getHomeForRole(role))
  }

  if (path.startsWith('/admin/invitations') && role !== 'admin') {
    return redirectPreservingSession(request, ref.response, getHomeForRole(role))
  }

  return ref.response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}