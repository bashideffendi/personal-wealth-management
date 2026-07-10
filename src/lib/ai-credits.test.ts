import { describe, it, expect, vi } from 'vitest'

// admin.ts pakai `import 'server-only'`; mock modulnya biar aman di node +
// createAdminClient() → null (jadi consume pakai supabase client yang kita fake).
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => null }))

import { consumeAICredits, AI_COSTS } from '@/lib/ai-credits'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Supabase palsu: rpc(reset/consume) + from().select().eq().maybeSingle(). */
function fakeSupabase(opts: {
  charged?: boolean
  chargeError?: { message: string } | null
  remaining?: number
}): SupabaseClient {
  return {
    rpc: async (fn: string) => {
      if (fn === 'consume_ai_credits') return { data: opts.charged ?? false, error: opts.chargeError ?? null }
      return { data: null, error: null } // reset_ai_credits_if_due
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { ai_credits: opts.remaining ?? 0 }, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient
}

describe('AI_COSTS', () => {
  it('biaya per fitur sesuai spec (jangan diam-diam berubah)', () => {
    expect(AI_COSTS.stock_research).toBe(30)
    expect(AI_COSTS.mutasi_import).toBe(25)
    expect(AI_COSTS.receipt_scan).toBe(5)
    expect(AI_COSTS.nl_parse).toBe(1)
    expect(AI_COSTS.insights).toBe(2)
    expect(AI_COSTS.playbook).toBe(8)
  })
})

describe('consumeAICredits', () => {
  it('kredit cukup → ok:true + remaining', async () => {
    const r = await consumeAICredits(fakeSupabase({ charged: true, remaining: 95 }), 'u1', 'insights')
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(95)
  })

  it('kredit habis → ok:false, status 402', async () => {
    const r = await consumeAICredits(fakeSupabase({ charged: false }), 'u1', 'stock_research')
    expect(r.ok).toBe(false)
    expect(r.status).toBe(402)
    expect(r.error).toContain('Kredit AI habis')
  })

  it('error RPC → status 500 + pesan GENERIK (gak bocorin internal DB)', async () => {
    const r = await consumeAICredits(
      fakeSupabase({ chargeError: { message: 'relation "consume_ai_credits" does not exist' } }),
      'u1',
      'insights',
    )
    expect(r.ok).toBe(false)
    expect(r.status).toBe(500)
    expect(r.error).toBe('Gagal memeriksa kredit AI. Coba lagi sebentar.')
    expect(r.error).not.toContain('consume_ai_credits')
  })
})
