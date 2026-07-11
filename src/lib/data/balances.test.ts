import { describe, expect, it, vi } from 'vitest'
import { adjustAccountBalance, adjustCardBalance, adjustDebtRemaining } from './balances'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Test jaring side-effect saldo — logika yang selama ini TANPA test padahal
 * salah delta = saldo korup permanen. Mock SupabaseClient tipis: cukup rpc()
 * dan from().update().eq().
 */

type UpdateCall = { table: string; payload: Record<string, number>; id: string }

function mockSupabase(opts: {
  rpcError?: { code?: string; message?: string } | null
  updateError?: { message: string } | null
}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const updateCalls: UpdateCall[] = []
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args })
      return { data: null, error: opts.rpcError ?? null }
    }),
    from: vi.fn((table: string) => ({
      update: (payload: Record<string, number>) => ({
        eq: async (_col: string, id: string) => {
          updateCalls.push({ table, payload, id })
          return { error: opts.updateError ?? null }
        },
      }),
    })),
  }
  return { client: client as unknown as SupabaseClient, rpcCalls, updateCalls }
}

const MISSING_FN = { code: 'PGRST202', message: 'could not find the function' }

describe('adjustCardBalance', () => {
  it('jalur RPC sukses: tidak menyentuh update langsung', async () => {
    const { client, rpcCalls, updateCalls } = mockSupabase({})
    const res = await adjustCardBalance(client, 'card-1', 250_000, 1_000_000)
    expect(res.ok).toBe(true)
    expect(rpcCalls).toEqual([{ fn: 'adjust_credit_card_balance', args: { p_card: 'card-1', p_delta: 250_000, p_clamp_zero: false } }])
    expect(updateCalls).toHaveLength(0)
  })

  it('fallback pre-migrasi (PGRST202): read-modify-write current_balance', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: MISSING_FN })
    const res = await adjustCardBalance(client, 'card-1', 250_000, 1_000_000)
    expect(res.ok).toBe(true)
    expect(updateCalls).toEqual([{ table: 'credit_cards', payload: { current_balance: 1_250_000 }, id: 'card-1' }])
  })

  it('error RPC non-missing-fn TIDAK jatuh ke fallback (jangan tulis dobel)', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: { code: '42501', message: 'not owned' } })
    const res = await adjustCardBalance(client, 'card-1', 100, 500)
    expect(res.ok).toBe(false)
    expect(res.error).toBe('not owned')
    expect(updateCalls).toHaveLength(0)
  })

  it('fallback + clampZero: reverse lebih besar dari saldo → 0, bukan negatif', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: MISSING_FN })
    await adjustCardBalance(client, 'card-1', -900_000, 500_000, true)
    expect(updateCalls[0].payload).toEqual({ current_balance: 0 })
  })
})

describe('adjustAccountBalance', () => {
  it('fallback menulis ke tabel accounts kolom current_balance', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: { code: '42883', message: 'undefined_function' } })
    const res = await adjustAccountBalance(client, 'acc-1', -50_000, 200_000)
    expect(res.ok).toBe(true)
    expect(updateCalls).toEqual([{ table: 'accounts', payload: { current_balance: 150_000 }, id: 'acc-1' }])
  })
})

describe('adjustDebtRemaining', () => {
  it('default clampZero=true: bayar melebihi sisa → sisa 0 (fallback)', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: MISSING_FN })
    const res = await adjustDebtRemaining(client, 'debt-1', -5_000_000, 3_000_000)
    expect(res.ok).toBe(true)
    expect(updateCalls).toEqual([{ table: 'debts', payload: { remaining: 0 }, id: 'debt-1' }])
  })

  it('reverse pembayaran (clampZero=false): sisa utang dikembalikan penuh', async () => {
    const { client, updateCalls } = mockSupabase({ rpcError: MISSING_FN })
    await adjustDebtRemaining(client, 'debt-1', 1_000_000, 2_000_000, false)
    expect(updateCalls[0].payload).toEqual({ remaining: 3_000_000 })
  })

  it('jalur RPC memanggil adjust_debt_remaining dengan p_debt + clamp default', async () => {
    const { client, rpcCalls } = mockSupabase({})
    await adjustDebtRemaining(client, 'debt-1', -100_000, 900_000)
    expect(rpcCalls).toEqual([{ fn: 'adjust_debt_remaining', args: { p_debt: 'debt-1', p_delta: -100_000, p_clamp_zero: true } }])
  })

  it('fallback gagal → ok:false + pesan error diteruskan', async () => {
    const { client } = mockSupabase({ rpcError: MISSING_FN, updateError: { message: 'RLS denied' } })
    const res = await adjustDebtRemaining(client, 'debt-1', -100, 900)
    expect(res).toEqual({ ok: false, error: 'RLS denied' })
  })
})
