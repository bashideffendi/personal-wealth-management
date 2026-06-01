// Penyusutan aset non-likuid (kendaraan & barang pribadi).
// Dua metode standar PSAK/pajak + opsi "tidak menyusut" (barang yang nilainya
// dipertahankan / malah naik, mis. perhiasan, tanah, koleksi seni).
//
// Catatan: new Date() aman di runtime app (ini kode client biasa, bukan
// workflow script — pembatasan Date.now() cuma berlaku di Workflow).

export type MetodePenyusutan = 'garis_lurus' | 'saldo_menurun_ganda' | 'none'

export const METODE_LABEL: Record<MetodePenyusutan, string> = {
  garis_lurus: 'Garis Lurus',
  saldo_menurun_ganda: 'Saldo Menurun Ganda',
  none: 'Tidak Menyusut',
}

export interface DepreciationInput {
  cost: number // harga perolehan (harga beli)
  residu: number // nilai residu — sisa nilai di akhir masa manfaat
  masaManfaat: number // tahun (> 0)
  metode: MetodePenyusutan
  start: string // tanggal perolehan, ISO yyyy-mm-dd
  asOf?: Date // default: sekarang
}

export interface DepreciationResult {
  bookValue: number // nilai buku / nilai sisa berjalan saat ini
  accumulated: number // akumulasi penyusutan
  perYearFirst: number // beban penyusutan tahun pertama (buat ditampilkan)
  yearsElapsed: number // umur aset (tahun, desimal)
  fullyDepreciated: boolean
}

function yearsBetween(start: string, asOf: Date): number {
  const s = new Date(start + 'T00:00:00')
  if (isNaN(s.getTime())) return 0
  return Math.max(0, (asOf.getTime() - s.getTime()) / (365.25 * 24 * 3600 * 1000))
}

export function depreciate(input: DepreciationInput): DepreciationResult {
  const asOf = input.asOf ?? new Date()
  const cost = Math.max(0, input.cost)
  const residu = Math.max(0, Math.min(input.residu || 0, cost))
  const masa = Math.max(0, input.masaManfaat || 0)
  const t = yearsBetween(input.start, asOf)

  // Tidak menyusut → nilai buku = harga perolehan (atau ditimpa manual di UI).
  if (input.metode === 'none' || masa <= 0) {
    return { bookValue: cost, accumulated: 0, perYearFirst: 0, yearsElapsed: t, fullyDepreciated: false }
  }

  const depreciable = cost - residu

  // Garis lurus: beban rata tiap tahun.
  if (input.metode === 'garis_lurus') {
    const perYear = depreciable / masa
    const acc = Math.min(perYear * t, depreciable)
    return {
      bookValue: cost - acc,
      accumulated: acc,
      perYearFirst: perYear,
      yearsElapsed: t,
      fullyDepreciated: acc >= depreciable - 0.01,
    }
  }

  // Saldo menurun ganda: tarif 2/masa atas nilai buku, di-floor ke residu,
  // tahun parsial diprorata. Dihitung tahun-per-tahun biar defensible saat diaudit.
  const rate = 2 / masa
  let book = cost
  let acc = 0
  let remaining = t
  let perYearFirst = cost * rate
  let first = true
  while (remaining > 0 && book > residu + 0.01) {
    const frac = Math.min(1, remaining)
    let dep = book * rate * frac
    if (book - dep < residu) dep = book - residu
    if (first) { perYearFirst = book * rate; first = false }
    book -= dep
    acc += dep
    remaining -= frac
  }
  return {
    bookValue: book,
    accumulated: acc,
    perYearFirst,
    yearsElapsed: t,
    fullyDepreciated: book <= residu + 0.01,
  }
}
