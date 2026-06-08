import type { SupabaseClient } from '@supabase/supabase-js'

/** Sensitive account events recorded to the audit log (table: security_events). */
export type SecurityEventType =
  | 'login'
  | 'password_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'

export interface SecurityEventRow {
  id: string
  event: string
  created_at: string
}

/**
 * Best-effort audit write. Resolves the current user itself, so callers just
 * pass the client + event. Never throws — if the table doesn't exist yet
 * (migration 047 not applied) or the insert fails, it's silently skipped so it
 * can't break the user-facing flow it's attached to.
 */
export async function logSecurityEvent(
  supabase: SupabaseClient,
  event: SecurityEventType,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('security_events').insert({ user_id: user.id, event })
  } catch {
    /* audit logging is best-effort */
  }
}
