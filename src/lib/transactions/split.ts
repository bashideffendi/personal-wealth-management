/**
 * Validasi pecah transaksi (split) — logika murni, dipakai dialog "Pecah"
 * (edit) DAN toggle "Bagi ke beberapa kategori" (tambah). Diekstrak dari
 * transactions/page.tsx (protokol pecah god-file, langkah A).
 *
 * Kontrak uang: total pecahan HARUS persis = nominal sumber (remaining 0),
 * minimal 2 baris, semua baris berkategori dan bernominal > 0.
 */

export type SplitRowLike = { category: string; amount: number }

export function splitAllocated(rows: readonly SplitRowLike[]): number {
  return rows.reduce((s, r) => s + r.amount, 0)
}

export function splitRemaining(rows: readonly SplitRowLike[], sourceAmount: number): number {
  return sourceAmount - splitAllocated(rows)
}

export function isSplitValid(rows: readonly SplitRowLike[], sourceAmount: number): boolean {
  return (
    sourceAmount > 0 &&
    rows.length >= 2 &&
    rows.every((r) => !!r.category && r.amount > 0) &&
    splitRemaining(rows, sourceAmount) === 0
  )
}
