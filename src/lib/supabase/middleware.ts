import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const isDemo =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').trim() === 'true' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
  //   - /                 → landing/marketing page
  //   - /login            → login form
  //   - /register         → register form
  //   - /auth/*           → OAuth callback handler
  //   - /api/*            → public API routes (have their own auth gates)
  // Any other path under an unauthenticated session → redirect to /login.
  const path = request.nextUrl.pathname
  const isPublicRoute =
    path === '/' ||
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/auth') ||
    path.startsWith('/api')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
