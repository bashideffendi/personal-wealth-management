/**
 * Cash-flow forecast — logika murni proyeksi saldo 30 hari (dipakai kartu
 * Forecast Saldo di Beranda). Dipisah dari komponen supaya bisa di-test.
 *
 * Dua mode:
 * 1. RECURRING (user rawat recurring transactions) — perilaku lama: jadwal
 *    recurring + jatuh tempo kontrak. Tagihan CC/utang TIDAK di-merge di sini
 *    supaya tidak double-count dengan recurring "bayar kartu" buatan user.
 * 2. BOOTSTRAP (recurring kosong) — proyeksi tetap jalan dari hari pertama:
 *    burn harian = rata-rata belanja 60 hari terakhir (expense NON-kartu-kredit;
 *    belanja kartu bukan uang likuid keluar — keluarnya saat bayar tagihan),
 *    plus tagihan terjadwal (saldo CC di due day + cicilan utang di anchor
 *    bulanannya — sumber & aturan sama persis kartu "Tagihan Terdekat").
 *    Pemasukan sengaja TIDAK ditebak — caption kartu menjelaskannya.
 *
 * KONTRAK ANGKA (jangan dilanggar diam-diam):
 * - CC payment = transfer, bukan expense (credit-cards/page.tsx sengaja tidak
 *   membuat row transaksi) → burn harian dari expense non-kartu + event bayar
 *   CC TIDAK pernah menghitung rupiah yang sama dua kali.
 * - Leg transfer antar akun (category 'Transfer') BUKAN uang keluar — di-skip,
 *   konsisten dengan semua agregasi expense lain di dashboard/report.
 * - Tagihan UTANG sengaja TIDAK disintesis: pembayaran utang tidak menyentuh
 *   akun/transaksi (debt_payments only), jadi kalau user ingin saldonya benar
 *   dia mencatatnya sebagai expense manual — dan expense itu SUDAH terwakili
 *   di burn rata-rata. Mensintesis bill utang = menghitung cicilan dua kali.
 *   (Kartu "Tagihan Terdekat" tetap menampilkannya — itu pengingat, bukan
 *   aritmetika saldo.)
 * - Burn harian = expense saja. Saving/investment historis tidak dirata-rata
 *   (besar dan tidak tiap hari — kalau rutin, tempatnya di recurring).
 * - Burn dikenakan penuh sejak hari-0 (hari ini) — sengaja konservatif;
 *   selisih maksimal satu hari burn terhadap belanja hari ini yang sudah
 *   terekam di saldo.
 */

/** Jendela proyeksi (hari) — dipakai kartu, bills, dan wiring dashboard. */
export const FORECAST_DAYS = 30

import { occurrencesInRange, parseISODate, toLocalISO, type RecurLike } from '@/lib/recurrence'

export interface RecurringItem {
  name: string
  type: string // 'income' | 'expense' | 'saving' | 'investment'
  amount: number
  frequency: string // 'monthly' | 'weekly' | 'yearly' | 'daily'
  day_of_period: number
  start_date?: string | null
  end_date?: string | null
}

export interface ContractItem {
  name: string
  end_date: string // ISO yyyy-mm-dd
  cost: number | null
  category: string
  is_archived: boolean
}

/** Satu kejadian tagihan pada tanggal pasti di jendela forecast. */
export interface BillEvent {
  iso: string // yyyy-mm-dd
  name: string
  amount: number
}

export interface DayPoint {
  date: Date
  iso: string
  inflow: number
  outflow: number
  events: { name: string; amount: number; kind: 'in' | 'out' }[]
  balance: number
}

export interface ForecastExtras {
  /** Burn rata-rata per hari (bootstrap) — mengurangi saldo TANPA baris event. */
  dailyBurn?: number
  /** Tagihan terjadwal (bootstrap) — outflow + baris event di tanggalnya. */
  bills?: BillEvent[]
  /** Injeksi "hari ini" untuk test — default startOfToday. */
  today?: Date
}

/**
 * Proyeksikan saldo maju N hari: recurring + kontrak (mode lama), ditambah
 * dailyBurn & bills bila diberikan (mode bootstrap).
 */
export function buildForecast(
  startBalance: number,
  recurring: RecurringItem[],
  contracts: ContractItem[],
  daysAhead: number,
  extras: ForecastExtras = {},
): DayPoint[] {
  const today = extras.today ? new Date(extras.today) : new Date()
  today.setHours(0, 0, 0, 0)
  const dailyBurn = extras.dailyBurn ?? 0
  const points: DayPoint[] = []
  let balance = startBalance

  // Jadwal kemunculan tiap item via lib recurrence — sama persis halaman
  // Recurring (anchor weekday/bulan, clamp bulan pendek, hormati end_date).
  // toLocalISO, bukan toISOString: di WIB toISOString menggeser tanggal -1 hari.
  const schedules = recurring.map((r) => ({
    r,
    dates: new Set(occurrencesInRange(r as RecurLike, today, daysAhead - 1).map(toLocalISO)),
  }))

  // Index bills per tanggal — satu tanggal bisa berisi beberapa tagihan.
  const billsByIso = new Map<string, BillEvent[]>()
  for (const b of extras.bills ?? []) {
    if (b.amount <= 0) continue
    const list = billsByIso.get(b.iso)
    if (list) list.push(b)
    else billsByIso.set(b.iso, [b])
  }

  for (let i = 0; i < daysAhead; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const iso = toLocalISO(date)

    let inflow = 0
    let outflow = 0
    const events: DayPoint['events'] = []

    for (const { r, dates } of schedules) {
      if (!dates.has(iso) || r.amount <= 0) continue
      if (r.type === 'income') {
        inflow += r.amount
        events.push({ name: r.name, amount: r.amount, kind: 'in' })
      } else {
        // expense / saving / investment sama-sama mengurangi saldo likuid
        outflow += r.amount
        events.push({ name: r.name, amount: r.amount, kind: 'out' })
      }
    }

    for (const c of contracts) {
      if (c.is_archived) continue
      if (!c.cost || c.cost <= 0) continue
      if (c.end_date !== iso) continue
      outflow += c.cost
      events.push({ name: `${c.name} (${c.category})`, amount: c.cost, kind: 'out' })
    }

    for (const b of billsByIso.get(iso) ?? []) {
      outflow += b.amount
      events.push({ name: b.name, amount: b.amount, kind: 'out' })
    }

    // Burn harian: pengurang halus, sengaja tanpa baris event (biar daftar
    // event tetap berisi kejadian nyata, bukan 30 baris "rata-rata").
    outflow += dailyBurn

    balance = balance + inflow - outflow
    points.push({ date, iso, inflow, outflow, events, balance })
  }

  return points
}

// ─── Bootstrap: tagihan terjadwal dari CC + utang ──────────────────────────

export interface BootstrapCardLike {
  name: string
  last_four?: string | null
  current_balance: number
  due_day: number
}

/**
 * Sintesis tagihan untuk jendela forecast — HANYA kartu kredit (lihat
 * KONTRAK ANGKA soal kenapa utang tidak ikut): saldo berjalan jatuh di
 * due_day BERIKUTNYA, satu kemunculan — saldo siklus berikutnya belum
 * diketahui. Aturan due-nya sama dengan kartu "Tagihan Terdekat".
 */
export function buildBootstrapBills(
  cards: BootstrapCardLike[],
  daysAhead: number,
  today: Date = new Date(),
): BillEvent[] {
  const from = new Date(today)
  from.setHours(0, 0, 0, 0)
  const out: BillEvent[] = []

  for (const c of cards) {
    if (c.current_balance <= 0) continue
    const occ = occurrencesInRange(
      { frequency: 'monthly', day_of_period: c.due_day } as RecurLike,
      from,
      daysAhead - 1,
    ).slice(0, 1)
    for (const d of occ) {
      out.push({
        iso: toLocalISO(d),
        name: `Bayar ${c.name}${c.last_four ? ` ••${c.last_four}` : ''}`,
        amount: c.current_balance,
      })
    }
  }

  return out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0))
}

// ─── Bootstrap: rata-rata belanja harian dari histori ──────────────────────

export interface TxLike {
  date: string // yyyy-mm-dd
  type: string
  amount: number
  account_id?: string | null
  category?: string | null
}

export interface AvgExpenseOptions {
  /** Lebar jendela histori (hari kalender), default 60. */
  windowDays?: number
  /** Minimal hari histori supaya rata-ratanya bermakna, default 14. */
  minSampleDays?: number
  today?: Date
}

/**
 * Rata-rata belanja LIKUID per hari kalender dari histori terakhir.
 * - Expense saja; transaksi pada kartu kredit di-exclude (bukan uang likuid
 *   keluar — keluarnya dihitung saat bayar tagihan kartu).
 * - Pembagi = hari kalender yang benar-benar ter-cover histori (jendela
 *   dipersempit ke transaksi pertama user), bukan hari-aktif — hari tanpa
 *   belanja itu sinyal, bukan bolong data.
 * - null bila histori < minSampleDays — lebih jujur tidak memproyeksikan
 *   daripada menebak dari 3 hari data.
 */
export function computeAvgDailyExpense(
  txs: TxLike[],
  cardAccountIds: ReadonlySet<string>,
  opts: AvgExpenseOptions = {},
): number | null {
  const windowDays = opts.windowDays ?? 60
  const minSampleDays = opts.minSampleDays ?? 14
  const today = opts.today ? new Date(opts.today) : new Date()
  today.setHours(0, 0, 0, 0)

  const windowStart = new Date(today)
  windowStart.setDate(today.getDate() - (windowDays - 1))
  const startIso = toLocalISO(windowStart)
  const todayIso = toLocalISO(today)

  // Transaksi PERTAMA (tipe apa pun) menandai sejak kapan user mencatat —
  // jendela efektif tidak boleh lebih tua dari itu.
  let firstIso: string | null = null
  for (const t of txs) {
    if (t.date <= todayIso && (firstIso === null || t.date < firstIso)) firstIso = t.date
  }
  if (firstIso === null) return null

  const effStartIso = firstIso > startIso ? firstIso : startIso
  const effStart = parseISODate(effStartIso)
  if (!effStart) return null
  const sampleDays = Math.round((today.getTime() - effStart.getTime()) / 86_400_000) + 1
  if (sampleDays < minSampleDays) return null

  let total = 0
  for (const t of txs) {
    if (t.type !== 'expense' || t.amount <= 0) continue
    // Leg transfer antar akun bukan uang keluar rumah tangga — konvensi yang
    // sama dengan totals/sankey/report di seluruh app.
    if (t.category === 'Transfer') continue
    if (t.date < effStartIso || t.date > todayIso) continue
    if (t.account_id && cardAccountIds.has(t.account_id)) continue
    total += t.amount
  }
  if (total <= 0) return null

  return total / sampleDays
}
