import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { needsStepUp } from '@/lib/auth-guard'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * UU PDP right-to-erasure — permanently deletes the authenticated user's data
 * and (when service-role is configured) the auth account itself.
 *
 * Data rows are removed child→parent so FK constraints never block a delete.
 * Uses the admin (service-role) client when available to bypass RLS + delete the
 * auth user; otherwise falls back to the user-scoped client (RLS-safe: a user
 * can only delete their own rows) and reports that the auth row still needs the
 * service-role key to be fully removed.
 */

// Child tables first; parents after. profiles handled separately (PK = id).
const DELETE_ORDER = [
  'debt_payments',
  'credit_card_payments',
  'emergency_fund_locations',
  'dividends',
  'stock_transactions',
  'transfers',
  'account_allocations',
  'recurring_transactions',
  'transactions',
  'budgets',
  'budget_categories',
  'categorization_rules',
  'watchlist',
  'contracts',
  'goals',
  'investments',
  'debts',
  'credit_cards',
  'emergency_funds',
  'assets_liquid',
  'assets_non_liquid',
  'accounts',
  'net_worth_snapshots',
  'portfolio_snapshots',
  'security_events',
  'household_activities',
  'subscriptions',
  'ai_credit_ledger',
  'xp_events',
  'achievements',
  'household_members',
] as const

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // 2FA step-up: hapus akun = ireversibel; kalau enroll 2FA tapi sesi AAL1, tolak.
  if (await needsStepUp(supabase)) {
    return NextResponse.json({ error: 'Selesaikan verifikasi 2FA dulu untuk menghapus akun.' }, { status: 403 })
  }

  const admin = createAdminClient()
  const db = admin ?? supabase
  const errors: Record<string, string> = {}

  // 1. Delete user-owned rows (best-effort; one table failing must not block the rest).
  for (const table of DELETE_ORDER) {
    const { error } = await db.from(table).delete().eq('user_id', user.id)
    if (error && !/does not exist|relation|column .* does not exist/i.test(error.message)) {
      errors[table] = error.message
    }
  }
  // Tabel dengan kolom pemilik ≠ user_id — hapus eksplisit supaya erasure gak
  // bergantung ke cascade auth (yg cuma jalan kalau service-role tersedia).
  // households delete akan cascade household_members/activities/invitations sisa.
  for (const [table, col] of [['household_invitations', 'invited_by'], ['households', 'owner_user_id']] as const) {
    const { error } = await db.from(table).delete().eq(col, user.id)
    if (error && !/does not exist|relation|column .* does not exist/i.test(error.message)) {
      errors[table] = error.message
    }
  }

  // profiles is keyed on id, not user_id.
  {
    const { error } = await db.from('profiles').delete().eq('id', user.id)
    if (error) errors['profiles'] = error.message
  }

  // 2. Delete uploaded receipts in storage (best-effort).
  try {
    const bucket = (admin ?? supabase).storage.from('receipts')
    const { data: files } = await bucket.list(user.id)
    if (files?.length) {
      await bucket.remove(files.map((f: { name: string }) => `${user.id}/${f.name}`))
    }
  } catch {
    /* storage cleanup is best-effort */
  }

  // 3. Delete the auth user — requires the service-role admin client.
  let authDeleted = false
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) errors['auth'] = error.message
    else authDeleted = true
  }

  // 4. Always end the current session.
  await supabase.auth.signOut()

  return NextResponse.json({
    ok: true,
    authDeleted,
    errors: Object.keys(errors).length ? errors : undefined,
  })
}
