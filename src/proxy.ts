import { NextResponse, type NextRequest } from 'next/server'
import { getServerClient } from './utils/supabase/getServerClient'

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

export async function proxy(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.role as string | undefined;

  const path = request.nextUrl.pathname
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );

  if (!user && !isPublicPath && path !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (path === '/login' || path === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = getHomeForRole(role)
    return NextResponse.redirect(url)
  }

  if (user && isPathOwnedByOtherRole(path, role)) {
    const url = request.nextUrl.clone()
    url.pathname = getHomeForRole(role)
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/admin/invitations') && role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = getHomeForRole(role)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}