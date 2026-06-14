/**
 * AI Credit Metering — server-side helpers.
 *
 * Cost per AI feature is defined here as a single source of truth.
 * Tuned roughly to actual API cost (×100 markup so 100 credits ≈ $1
 * worth of upstream usage):
 *
 *   - Receipt scan (Vision):     5 credits  (~$0.005-0.01 upstream)
 *   - NL parse (Haiku text):     1 credit   (~$0.0005 upstream)
 *   - Insights (Haiku, cached):  2 credits  (~$0.001 upstream, 24h cache)
 *
 * Solo free tier gets 10 credits/month → enough for ~2 receipt scans
 * + 5 quick adds + a few insight refreshes. Anything beyond needs Pro.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

export const AI_COSTS = {
  receipt_scan: 5,
  nl_parse: 1,
  insights: 2,
  voice_parse: 1,  // voice → AI parse uses same cost as text parse
  // Bulk import = one heavy call yang produce banyak transaksi sekaligus.
  // Marked-up biar coherent dengan per-line economics (mutasi 50 baris bisa
  // jadi cost ~Rp 5 kalau dipecah jadi 50× nl_parse; 25 credits = setara).
  mutasi_import: 25,
  // Stock research generation = long-form prompt, big output (~3000 tokens).
  // Sharing model: first user pays, semua user lain free dari cache.
  // 30 credits = around 6× receipt_scan, accounts for sonnet pricing kalau
  // suatu hari kita switch dari haiku ke sonnet untuk quality.
  stock_research: 30,
  // Playbook plan = long-form personalized financial plan (target, setoran,
  // milestones, tips). Output lebih besar dari insights, satu kali per generate.
  playbook: 8,
} as const

export type AICostKey = keyof typeof AI_COSTS

export interface CreditCheckResult {
  ok: boolean
  status?: number
  error?: string
  remaining?: number
}

/**
 * Atomic credit consumption. Returns ok=true if charged, otherwise
 * an error response shape ready to be returned from an API route.
 *
 * Steps:
 *   1. Lazy reset if past renewal date (top up to plan cap)
 *   2. Atomic consume via SQL function (race-safe)
 *   3. Return remaining balance for client display
 */
export async function consumeAICredits(
  supabase: SupabaseClient,
  userId: string,
  costKey: AICostKey,
): Promise<CreditCheckResult> {
  const cost = AI_COSTS[costKey]

  // Step 1: top up if renewal due
  // Credit mutations run via the service-role client when configured, so the
  // metering RPCs are not reachable by users directly (they only have the
  // user-scoped client). Falls back to the request client until
  // SUPABASE_SERVICE_ROLE_KEY is provisioned — see migration 026.
  const privileged = createAdminClient() ?? supabase

  const { error: resetErr } = await privileged.rpc('reset_ai_credits_if_due', { p_user_id: userId })
  if (resetErr) console.error('[ai-credits] reset_if_due gagal (jatah bulanan mungkin belum ke-reset):', resetErr.message)

  // Step 2: atomic consume
  const { data: charged, error } = await privileged.rpc('consume_ai_credits', {
    p_user_id: userId,
    p_amount: cost,
  })

  if (error) {
    return {
      ok: false,
      status: 500,
      error: 'Gagal mengecek kredit AI: ' + error.message,
    }
  }

  if (!charged) {
    return {
      ok: false,
      status: 402, // Payment Required
      error: `Kredit AI habis. Butuh ${cost} kredit untuk ${
        costKey === 'receipt_scan' ? 'scan struk'
        : costKey === 'insights' ? 'AI insight'
        : costKey === 'mutasi_import' ? 'import mutasi'
        : costKey === 'stock_research' ? 'generate research saham'
        : costKey === 'playbook' ? 'buat rencana playbook'
        : 'AI parse'
      }. Upgrade ke paket lebih tinggi atau tunggu reset bulanan.`,
    }
  }

  // Step 3: read remaining for response
  const { data: profile } = await supabase
    .from('profiles')
    .select('ai_credits')
    .eq('id', userId)
    .maybeSingle<{ ai_credits: number }>()

  return { ok: true, remaining: profile?.ai_credits ?? 0 }
}

/**
 * Refund credits to a user — for use in API route catch blocks when the
 * upstream Anthropic call fails after we've already charged.
 *
 * Best-effort: silently swallows errors so a refund failure never masks
 * the original error we're returning to the user. The amount is clamped
 * server-side to the plan cap so this can never grant free credits.
 */
export async function refundAICredits(
  supabase: SupabaseClient,
  userId: string,
  costKey: AICostKey,
): Promise<void> {
  const amount = AI_COSTS[costKey]
  try {
    const privileged = createAdminClient() ?? supabase
    await privileged.rpc('refund_ai_credits', {
      p_user_id: userId,
      p_amount: amount,
    })
  } catch (err) {
    // Non-throwing (refund failure shouldn't shadow the upstream error), tapi
    // LOG supaya kredit yg gagal di-refund bisa di-rekonsiliasi (bukan hilang diam2).
    console.error('[ai-credits] refund failed:', userId, costKey, err instanceof Error ? err.message : err)
  }
}
