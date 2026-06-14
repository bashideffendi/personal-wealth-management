import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

// User-owned tables (each RLS-scoped to the owner). Market-data / shared caches
// (price_history, price_snapshots, stock_research_cache, plans) are intentionally
// excluded — they aren't the user's personal data.
const TABLES = [
  'profiles',
  'accounts',
  'transactions',
  'budgets',
  'assets_liquid',
  'assets_non_liquid',
  'investments',
  'debts',
  'debt_payments',
  'emergency_funds',
  'emergency_fund_locations',
  'transfers',
  'credit_cards',
  'credit_card_payments',
  'goals',
  'recurring_transactions',
  'dividends',
  'net_worth_snapshots',
  'categorization_rules',
  'stock_transactions',
  'contracts',
  'account_allocations',
  'watchlist',
  'subscriptions',
  'ai_credit_ledger',
  'household_members',
  'household_activities',
  'household_invitations',
  'portfolio_snapshots',
  'budget_categories',
  'emergency_fund_transactions',
  'security_events',
]

// Page through a table so exports aren't capped at Supabase's 1000-row default.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll(supabase: any, table: string) {
  const pageSize = 1000
  let from = 0
  const rows: unknown[] = []
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1)
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

  const data: Record<string, unknown> = {}
  for (const table of TABLES) {
    const res = await fetchAll(supabase, table)
    data[table] = 'error' in res ? { _error: res.error } : res.rows
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
