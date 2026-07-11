import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createMockClient } from '@/lib/demo/mock-client'
import type { Database } from '@/types/database.types'

export type TypedSupabaseClient = SupabaseClient<Database>

// Demo mode is OPT-IN ONLY (explicit flag) and never on production Vercel.
// (VERCEL_ENV is undefined in the browser bundle → relies on the flag client-side,
// which is unset in prod; the server/middleware gate is the real protection.)
const isDemo =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').trim() === 'true' &&
  process.env.VERCEL_ENV !== 'production'

export function createClient(): TypedSupabaseClient {
  if (isDemo) {
    return createMockClient() as unknown as TypedSupabaseClient
  }
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
