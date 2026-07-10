/**
 * Kontribusi transaksi ke outstanding KARTU KREDIT — math uang paling sensitif
 * di halaman transaksi, diekstrak dari transactions/page.tsx (protokol pecah
 * god-file, langkah A) supaya terkunci test.
 *
 * Kontrak (lihat AGENTS.md "Semantik saldo"): HANYA expense bernominal > 0
 * yang menarget kartu kredit yang menaikkan outstanding. Edit/pindah/hapus
 * harus SIMETRIS: kontribusi lama dikurangkan, kontribusi baru ditambahkan —
 * net per-kartu, supaya kartu yang ada di dua sisi edit tidak dobel-baca.
 */

import type { TxType } from './rules'

export type TxLike = { type: TxType; account_id: string; amount: number }

/** Rupiah yang transaksi ini sumbangkan ke outstanding kartu (0 kalau bukan expense-di-kartu). */
export function ccContribution(tx: TxLike, isCard: (accountId: string) => boolean): number {
  return tx.type === 'expense' && tx.amount > 0 && isCard(tx.account_id) ? tx.amount : 0
}

/**
 * Net delta outstanding per kartu untuk operasi simpan (create/edit).
 * prev = transaksi sebelum edit (null saat create). Entry delta 0 dibuang.
 */
export function computeCardDeltas(
  prev: TxLike | null,
  next: TxLike,
  isCard: (accountId: string) => boolean,
): Record<string, number> {
  const deltas: Record<string, number> = {}
  if (prev) {
    const old = ccContribution(prev, isCard)
    if (old) deltas[prev.account_id] = (deltas[prev.account_id] ?? 0) - old
  }
  const nu = ccContribution(next, isCard)
  if (nu) deltas[next.account_id] = (deltas[next.account_id] ?? 0) + nu
  for (const [id, d] of Object.entries(deltas)) if (d === 0) delete deltas[id]
  return deltas
}

/** Net delta per kartu untuk MEMBATALKAN kontribusi transaksi terhapus (delete/bulk delete). */
export function reverseCardDeltas(
  removed: readonly TxLike[],
  isCard: (accountId: string) => boolean,
): Record<string, number> {
  const deltas: Record<string, number> = {}
  for (const tx of removed) {
    const c = ccContribution(tx, isCard)
    if (c) deltas[tx.account_id] = (deltas[tx.account_id] ?? 0) - c
  }
  return deltas
}
