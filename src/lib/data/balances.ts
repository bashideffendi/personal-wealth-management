import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Satu jalur tulis SALDO — increment ATOMIK via RPC (migrasi 059), menutup race
 * lost-update dari pola lama `current_balance = <state-client-basi> + amount`.
 *
 * Backward-compatible: kalau RPC belum di-apply di DB (fungsi belum ada), jatuh
 * ke read-modify-write lama pakai `fallbackCurrent` — jadi perilaku live tidak
 * pernah break sebelum migrasi 059 masuk. Begitu 059 di-apply, otomatis atomik.
 */

type Result = { ok: boolean; error?: string }

function isMissingFn(err: { code?: string; message?: string }): boolean {
  // PostgREST PGRST202 (fn tak ada di schema cache) / Postgres 42883 (undefined_function)
  return (
    err.code === 'PGRST202' ||
    err.code === '42883' ||
    /function .* does not exist|could not find the function/i.test(err.message ?? '')
  )
}

async function adjust(
  supabase: SupabaseClient,
  rpc: 'adjust_credit_card_balance' | 'adjust_account_balance',
  idKey: 'p_card' | 'p_account',
  table: 'credit_cards' | 'accounts',
  id: string,
  delta: number,
  fallbackCurrent: number,
  clampZero: boolean,
): Promise<Result> {
  const { error } = await supabase.rpc(rpc, { [idKey]: id, p_delta: delta, p_clamp_zero: clampZero })
  if (!error) return { ok: true }
  if (isMissingFn(error)) {
    const next = clampZero ? Math.max(0, fallbackCurrent + delta) : fallbackCurrent + delta
    const { error: e2 } = await supabase.from(table).update({ current_balance: next }).eq('id', id)
    return e2 ? { ok: false, error: e2.message } : { ok: true }
  }
  return { ok: false, error: error.message }
}

/** Tambah/kurang saldo kartu kredit (delta boleh negatif). clampZero = jangan di bawah 0. */
export function adjustCardBalance(
  supabase: SupabaseClient, cardId: string, delta: number, fallbackCurrent: number, clampZero = false,
): Promise<Result> {
  return adjust(supabase, 'adjust_credit_card_balance', 'p_card', 'credit_cards', cardId, delta, fallbackCurrent, clampZero)
}

/** Tambah/kurang saldo rekening (delta boleh negatif). */
export function adjustAccountBalance(
  supabase: SupabaseClient, accountId: string, delta: number, fallbackCurrent: number, clampZero = false,
): Promise<Result> {
  return adjust(supabase, 'adjust_account_balance', 'p_account', 'accounts', accountId, delta, fallbackCurrent, clampZero)
}
