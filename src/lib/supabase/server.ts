import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createMockClient } from '@/lib/demo/mock-client'
import type { Database } from '@/types/database.types'

export type TypedSupabaseClient = SupabaseClient<Database>

// Demo mode is OPT-IN ONLY (explicit flag) and never on production Vercel.
// Missing Supabase env in a real deploy FAILS CLOSED (client throws below)
// instead of silently mocking an authenticated session.
const isDemo =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').trim() === 'true' &&
  process.env.VERCEL_ENV !== 'production'

export async function createClient(): Promise<TypedSupabaseClient> {
  if (isDemo) {
    return createMockClient() as unknown as TypedSupabaseClient
  }

  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
