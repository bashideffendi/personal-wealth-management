import type { SupabaseClient } from '@supabase/supabase-js'
import { adjustAccountBalance, adjustCardBalance } from './balances'

type Bal = { id: string; current_balance: number }

/**
 * Efek saldo "Bayar kartu kredit" (pengecualian #2 di AGENTS.md): outstanding
 * kartu turun (clamp 0) dan rekening sumber (opsional) berkurang — tanpa
 * transaksi. All-or-nothing dengan KOMPENSASI, semua lewat balances.ts:
 *
 * 1. Rekening didebit DULU — delta tanpa clamp, jadi pembalikannya persis.
 * 2. Kartu dikurangi. Gagal → rekening dikembalikan dengan delta +amount.
 *
 * Dulu urutannya terbalik dan rollback kartu menulis saldo ABSOLUT dari state
 * klien (`.update({ current_balance: card.current_balance })`) — menimpa
 * perubahan lain yang terjadi di antaranya.
 */
export async function applyCardPaymentBalances(
  supabase: SupabaseClient,
  amount: number,
  card: Bal | undefined,
  account: Bal | undefined,
): Promise<{ ok: boolean }> {
  if (account) {
    const { ok } = await adjustAccountBalance(supabase, account.id, -amount, account.current_balance)
    if (!ok) return { ok: false }
  }
  if (card) {
    const { ok } = await adjustCardBalance(supabase, card.id, -amount, card.current_balance, true)
    if (!ok) {
      if (account) await adjustAccountBalance(supabase, account.id, amount, account.current_balance - amount)
      return { ok: false }
    }
  }
  return { ok: true }
}
