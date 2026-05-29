import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for privileged, server-only operations —
 * currently the AI-credit metering RPCs (consume/refund/reset). It runs as
 * `service_role`, which BYPASSES Row-Level Security, so:
 *   - NEVER import this from a client component or pass its results to the
 *     browser. `import 'server-only'` above makes a client-side import a build
 *     error.
 *   - It must only be used for operations the user is not allowed to perform
 *     directly (e.g. mutating their own ai_credits balance).
 *
 * Returns `null` when SUPABASE_SERVICE_ROLE_KEY is not configured, so callers
 * can fall back to the request-scoped (user) client. That keeps the app fully
 * working before the key is provisioned — it just doesn't yet close the
 * "user refills their own credits via the refund RPC" hole (see migration 026).
 */
let cached: SupabaseClient | null | undefined

export function createAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  cached =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  return cached
}
