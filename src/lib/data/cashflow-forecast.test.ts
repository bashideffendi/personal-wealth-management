import { describe, it, expect } from 'vitest'
import {
  buildForecast,
  buildBootstrapBills,
  computeAvgDailyExpense,
  type RecurringItem,
  type TxLike,
} from './cashflow-forecast'

// Hari referensi tetap supaya test deterministik (Rabu, 15 Jul 2026).
const TODAY = new Date(2026, 6, 15)
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

describe('buildForecast — mode recurring (perilaku lama)', () => {
  it('gaji masuk & tagihan keluar di tanggal anchor-nya, saldo konsisten', () => {
    const recurring: RecurringItem[] = [
      { name: 'Gaji', type: 'income', amount: 10_000_000, frequency: 'monthly', day_of_period: 25 },
      { name: 'Listrik', type: 'expense', amount: 500_000, frequency: 'monthly', day_of_period: 20 },
    ]
    const points = buildForecast(1_000_000, recurring, [], 30, { today: TODAY })
    expect(points).toHaveLength(30)
    const byIso = new Map(points.map((p) => [p.iso, p]))

    const listrik = byIso.get(iso(2026, 7, 20))!
    expect(listrik.outflow).toBe(500_000)
    expect(listrik.events).toEqual([{ name: 'Listrik', amount: 500_000, kind: 'out' }])

    const gajian = byIso.get(iso(2026, 7, 25))!
    expect(gajian.inflow).toBe(10_000_000)

    // Saldo akhir = awal + gaji - listrik (tidak ada burn di mode recurring).
    expect(points[29].balance).toBe(1_000_000 + 10_000_000 - 500_000)
  })

  it('kontrak jatuh tempo jadi outflow satu kali; arsip di-skip', () => {
    const contracts = [
      { name: 'Asuransi', end_date: iso(2026, 7, 18), cost: 750_000, category: 'insurance', is_archived: false },
      { name: 'Lama', end_date: iso(2026, 7, 19), cost: 999_000, category: 'lease', is_archived: true },
    ]
    const points = buildForecast(2_000_000, [], contracts, 30, { today: TODAY })
    const hit = points.find((p) => p.iso === iso(2026, 7, 18))!
    expect(hit.outflow).toBe(750_000)
    expect(points.find((p) => p.iso === iso(2026, 7, 19))!.outflow).toBe(0)
    expect(points[29].balance).toBe(2_000_000 - 750_000)
  })
})

describe('buildForecast — mode bootstrap (burn harian + bills)', () => {
  it('dailyBurn mengurangi saldo tiap hari TANPA baris event', () => {
    const points = buildForecast(3_000_000, [], [], 30, { today: TODAY, dailyBurn: 100_000 })
    expect(points[0].outflow).toBe(100_000)
    expect(points[0].events).toHaveLength(0)
    expect(points[29].balance).toBe(3_000_000 - 30 * 100_000)
  })

  it('bill muncul sebagai event di tanggalnya dan dijumlah bersama burn', () => {
    const bills = [{ iso: iso(2026, 7, 20), name: 'Bayar BCA ••1234', amount: 1_500_000 }]
    const points = buildForecast(5_000_000, [], [], 30, { today: TODAY, dailyBurn: 50_000, bills })
    const due = points.find((p) => p.iso === iso(2026, 7, 20))!
    expect(due.outflow).toBe(1_550_000)
    expect(due.events).toEqual([{ name: 'Bayar BCA ••1234', amount: 1_500_000, kind: 'out' }])
    expect(points[29].balance).toBe(5_000_000 - 30 * 50_000 - 1_500_000)
  })

  it('bill di luar jendela / amount nol diabaikan', () => {
    const bills = [
      { iso: iso(2026, 9, 1), name: 'Kelewat jauh', amount: 1_000_000 },
      { iso: iso(2026, 7, 16), name: 'Nol', amount: 0 },
    ]
    const points = buildForecast(1_000_000, [], [], 30, { today: TODAY, bills })
    expect(points.every((p) => p.outflow === 0)).toBe(true)
  })
})

describe('buildBootstrapBills', () => {
  it('CC: satu kemunculan di due_day berikutnya, amount = saldo berjalan', () => {
    const bills = buildBootstrapBills(
      [{ name: 'BCA Every Day', last_four: '7685', current_balance: 21_000_000, due_day: 15 }],
      30,
      TODAY,
    )
    expect(bills).toEqual([
      { iso: iso(2026, 7, 15), name: 'Bayar BCA Every Day ••7685', amount: 21_000_000 },
    ])
  })

  it('CC saldo nol tidak menghasilkan tagihan', () => {
    expect(
      buildBootstrapBills([{ name: 'Idle', last_four: null, current_balance: 0, due_day: 5 }], 30, TODAY),
    ).toEqual([])
  })

  it('beberapa kartu diurutkan per tanggal due', () => {
    const bills = buildBootstrapBills(
      [
        { name: 'Mandiri', last_four: '5465', current_balance: 5_000_000, due_day: 28 },
        { name: 'BCA', last_four: '7685', current_balance: 21_000_000, due_day: 18 },
      ],
      30,
      TODAY,
    )
    expect(bills.map((b) => b.iso)).toEqual([iso(2026, 7, 18), iso(2026, 7, 28)])
  })
})

describe('computeAvgDailyExpense', () => {
  const cardIds = new Set(['cc-1'])

  it('rata-rata = total expense non-kartu / hari kalender jendela', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 7, 1), type: 'expense', amount: 300_000, account_id: 'bank-1' },
      { date: iso(2026, 6, 20), type: 'expense', amount: 900_000, account_id: 'bank-1' },
      // Histori sudah lebih tua dari jendela → pembagi penuh 60 hari.
      { date: iso(2026, 4, 1), type: 'income', amount: 10_000_000, account_id: 'bank-1' },
    ]
    const avg = computeAvgDailyExpense(txs, cardIds, { today: TODAY })
    expect(avg).toBeCloseTo(1_200_000 / 60, 6)
  })

  it('belanja di kartu kredit di-exclude (bukan uang likuid keluar)', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 7, 1), type: 'expense', amount: 600_000, account_id: 'bank-1' },
      { date: iso(2026, 7, 2), type: 'expense', amount: 5_000_000, account_id: 'cc-1' },
      { date: iso(2026, 4, 1), type: 'income', amount: 1, account_id: 'bank-1' },
    ]
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeCloseTo(600_000 / 60, 6)
  })

  it('leg transfer antar akun (category Transfer) tidak masuk burn', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 7, 1), type: 'expense', amount: 600_000, account_id: 'bank-1', category: 'Makanan' },
      { date: iso(2026, 7, 3), type: 'expense', amount: 10_000_000, account_id: 'bank-1', category: 'Transfer' },
      { date: iso(2026, 4, 1), type: 'income', amount: 1, account_id: 'bank-1' },
    ]
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeCloseTo(600_000 / 60, 6)
  })

  it('saving/investment/income tidak masuk burn', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 7, 1), type: 'saving', amount: 2_000_000, account_id: 'bank-1' },
      { date: iso(2026, 7, 2), type: 'investment', amount: 3_000_000, account_id: 'bank-1' },
      { date: iso(2026, 4, 1), type: 'income', amount: 10_000_000, account_id: 'bank-1' },
    ]
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeNull()
  })

  it('pembagi menyempit ke transaksi pertama user (bukan 60 penuh)', () => {
    // User baru mencatat sejak 26 Jun (20 hari termasuk hari ini).
    const txs: TxLike[] = [
      { date: iso(2026, 6, 26), type: 'expense', amount: 2_000_000, account_id: 'bank-1' },
    ]
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeCloseTo(2_000_000 / 20, 6)
  })

  it('histori < 14 hari → null (jangan menebak dari data setipis itu)', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 7, 10), type: 'expense', amount: 500_000, account_id: 'bank-1' },
    ]
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeNull()
  })

  it('transaksi berdate depan (typo tanggal) tidak merusak jendela', () => {
    const txs: TxLike[] = [
      { date: iso(2026, 12, 31), type: 'expense', amount: 9_000_000, account_id: 'bank-1' },
      { date: iso(2026, 6, 1), type: 'expense', amount: 600_000, account_id: 'bank-1' },
    ]
    // Tx masa depan di-exclude dari total & tidak jadi firstIso.
    expect(computeAvgDailyExpense(txs, cardIds, { today: TODAY })).toBeCloseTo(600_000 / 45, 6)
  })

  it('tanpa transaksi sama sekali → null', () => {
    expect(computeAvgDailyExpense([], cardIds, { today: TODAY })).toBeNull()
  })
})
