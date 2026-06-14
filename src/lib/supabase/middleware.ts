import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Demo mode is OPT-IN ONLY (explicit flag) and can NEVER activate on the
// production Vercel deployment. A missing/typo'd Supabase env must FAIL CLOSED
// (the Supabase client throws below) — we must NOT silently serve an
// unauthenticated mock session on a real production deploy.
const isDemo =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').trim() === 'true' &&
  process.env.VERCEL_ENV !== 'production'

export async function updateSession(request: NextRequest) {
  // Demo mode: bypass all auth. If someone hits /login or /register, push them
  // into the dashboard so they can see the UI without registering.
  if (isDemo) {
    const path = request.nextUrl.pathname
    if (path.startsWith('/login') || path.startsWith('/register')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that anonymous users can access without redirect:
  //   - /                                   → landing
  //   - /login /register /forgot-password   → auth forms
  //   - /features /about /contact           → marketing pages
  //   - /terms /privacy /refund             → legal pages
  //   - /auth/*                             → OAuth callback handler
  //   - /api/*                              → public API routes (own auth gates)
  //   - static files at root (sw.js, manifest.json, offline.html, robots.txt,
  //     sitemap.xml, …) — the matcher only excludes _next + images, so these
  //     .js/.json/.html/.txt/.xml files would otherwise be gated and break the
  //     PWA/SEO. Matched by extension so new public assets don't need adding.
  // Any other path under an unauthenticated session → redirect to /login.
  const path = request.nextUrl.pathname
  const isPublicRoute =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/features') ||
    path.startsWith('/about') ||
    path.startsWith('/contact') ||
    path.startsWith('/terms') ||
    path.startsWith('/privacy') ||
    path.startsWith('/refund') ||
    path.startsWith('/auth') ||
    path.startsWith('/api') ||
    /\.(?:js|json|html|txt|xml|webmanifest|ico)$/.test(path)

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
