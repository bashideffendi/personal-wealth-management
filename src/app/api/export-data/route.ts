import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { needsStepUp } from '@/lib/auth-guard'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * UU PDP data-subject export — returns ALL of the authenticated user's data as
 * a downloadable JSON file.
 *
 * Safety: uses the user-scoped SSR client (cookies/session), so every query is
 * RLS-scoped to auth.uid() automatically. NO service-role key, NO RLS bypass —
 * a logged-in user can only ever export their own rows. Unauthenticated → 401.
 */

// User-owned tables + kolom pemiliknya. Market-data / shared caches
// (price_history, price_snapshots, stock_research_cache, plans) sengaja tidak
// ikut — bukan data pribadi user.
//
// Filter pemilik EKSPLISIT (bukan cuma RLS): policy SELECT household
// (accounts/transactions/budgets/goals/household_*) juga meloloskan baris
// ANGGOTA LAIN satu household — tanpa filter, file ekspor "data saya" ikut
// membawa data keuangan orang lain. owner = null → andalkan RLS (tabel anak
// tanpa kolom user_id; RLS-nya sudah own-only lewat parent).
const EXPORT_TABLES: ReadonlyArray<{ table: string; owner: string | null; columns?: string }> = [
  { table: 'profiles', owner: 'id' },
  { table: 'accounts', owner: 'user_id' },
  { table: 'transactions', owner: 'user_id' },
  { table: 'budgets', owner: 'user_id' },
  { table: 'budget_categories', owner: 'user_id' },
  { table: 'assets_liquid', owner: 'user_id' },
  { table: 'assets_non_liquid', owner: 'user_id' },
  { table: 'investments', owner: 'user_id' },
  { table: 'debts', owner: 'user_id' },
  { table: 'debt_payments', owner: 'user_id' },
  { table: 'emergency_funds', owner: 'user_id' },
  { table: 'emergency_fund_locations', owner: null },
  { table: 'emergency_fund_transactions', owner: null },
  { table: 'transfers', owner: 'user_id' },
  { table: 'credit_cards', owner: 'user_id' },
  { table: 'credit_card_payments', owner: 'user_id' },
  { table: 'goals', owner: 'user_id' },
  { table: 'recurring_transactions', owner: 'user_id' },
  { table: 'dividends', owner: 'user_id' },
  { table: 'net_worth_snapshots', owner: 'user_id' },
  { table: 'portfolio_snapshots', owner: 'user_id' },
  { table: 'categorization_rules', owner: 'user_id' },
  { table: 'stock_transactions', owner: 'user_id' },
  { table: 'contracts', owner: 'user_id' },
  { table: 'account_allocations', owner: 'user_id' },
  { table: 'watchlist', owner: 'user_id' },
  { table: 'subscriptions', owner: 'user_id' },
  { table: 'ai_credit_ledger', owner: 'user_id' },
  { table: 'xp_events', owner: 'user_id' },
  { table: 'achievements', owner: 'user_id' },
  { table: 'notifications', owner: 'user_id' },
  // Kunci p256dh/auth sengaja tidak diekspor (kredensial device, bukan data user).
  { table: 'push_subscriptions', owner: 'user_id', columns: 'id, endpoint, created_at' },
  { table: 'households', owner: 'owner_user_id' },
  { table: 'household_members', owner: 'user_id' },
  { table: 'household_activities', owner: 'user_id' },
  { table: 'household_invitations', owner: 'invited_by' },
  { table: 'security_events', owner: 'user_id' },
]

// Page through a table so exports aren't capped at Supabase's 1000-row default.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(supabase: any, spec: (typeof EXPORT_TABLES)[number], userId: string) {
  const pageSize = 1000
  let from = 0
  const rows: unknown[] = []
  for (;;) {
    let q = supabase.from(spec.table).select(spec.columns ?? '*')
    if (spec.owner) q = q.eq(spec.owner, userId)
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error) return { error: error.message }
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return { rows }
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // 2FA step-up: kalau user enroll 2FA tapi sesi masih AAL1, tolak ekspor data.
  if (await needsStepUp(supabase)) {
    return NextResponse.json({ error: 'Selesaikan verifikasi 2FA dulu untuk mengekspor data.' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  for (const spec of EXPORT_TABLES) {
    const res = await fetchAll(supabase, spec, user.id)
    data[spec.table] = 'error' in res ? { _error: res.error } : res.rows
  }

  const payload = {
    _meta: {
      app: 'Klunting',
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      note: 'Ekspor data pribadi (hak akses data subject, UU PDP No. 27/2022).',
    },
    data,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="klunting-data-export.json"',
      'Cache-Control': 'no-store',
    },
  })
}
