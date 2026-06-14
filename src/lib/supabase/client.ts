import { createBrowserClient } from '@supabase/ssr'
import { createMockClient } from '@/lib/demo/mock-client'

// Demo mode is OPT-IN ONLY (explicit flag) and never on production Vercel.
// (VERCEL_ENV is undefined in the browser bundle → relies on the flag client-side,
// which is unset in prod; the server/middleware gate is the real protection.)
const isDemo =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? '').trim() === 'true' &&
  process.env.VERCEL_ENV !== 'production'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  if (isDemo) {
    return createMockClient()
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
