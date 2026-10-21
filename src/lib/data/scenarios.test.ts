import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeNetWorth, sumField } from './net-worth'
import { inMonth, monthBounds, monthFlow, sumFlow } from './flow'
import { fetchAllRows } from './fetch-all'
import { applyCardPaymentBalances } from './card-payment'
import { adjustDebtRemaining } from './balances'
import { computeAvgDailyExpense } from './cashflow-forecast'
import { averageMonthlyIncome, fetchMonthlyIncome } from './monthly-income'
import { loadMonthlyActuals } from '../budget-categories'
import { computeCardDeltas, reverseCardDeltas } from '../transactions/cc-delta'
import { parseFlexibleAmount } from '../transactions/csv'
import { toLocalISO } from '../recurrence'

/**
 * Skenario uang ujung-ke-ujung (audit 2026-10 deep). Semua layar memakai
 * fungsi kanonik yang sama: net worth → lib/data/net-worth, arus bulanan →
 * lib/data/flow (dashboard + laporan), saldo → lib/data/balances. Jadi angka
 * yang dikunci di sini = angka di dashboard, halaman terkait, dan laporan.
 */

// ── Ledger tiruan: RPC adjust_* + from(..).select paginated ────────────────
type Ledger = { accounts: Record<string, number>; credit_cards: Record<string, number>; debts: Record<string, number> }

function fakeDb(ledger: Ledger, failRpc?: string) {
  const calls: Array<{ fn: string; id: string; delta: number }> = []
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    const id = String(args.p_account ?? args.p_card ?? args.p_debt)
    const delta = Number(args.p_delta)
    calls.push({ fn, id, delta })
    if (fn === failRpc) return { data: null, error: { message: 'boom' } }
    const table = fn === 'adjust_account_balance' ? ledger.accounts : fn === 'adjust_credit_card_balance' ? ledger.credit_cards : ledger.debts
    const next = table[id] + delta
    table[id] = args.p_clamp_zero ? Math.max(0, next) : next
    return { data: null, error: null }
  })
  return { client: { rpc } as unknown as SupabaseClient, calls }
}

const nwOf = (l: Ledger, extra: { nonLiquid?: number; investments?: number } = {}) =>
  computeNetWorth({
    liquid: Object.values(l.accounts).reduce((a, b) => a + b, 0),
    nonLiquid: extra.nonLiquid ?? 0,
    investments: extra.investments ?? 0,
    debts: Object.values(l.debts).reduce((a, b) => a + b, 0),
    creditCards: Object.values(l.credit_cards).reduce((a, b) => a + b, 0),
  }).netWorth

describe('net worth kanonik', () => {
  it('aset − (utang + kartu); sama untuk semua pemanggil', () => {
    const nw = computeNetWorth({ liquid: 10_000_000, nonLiquid: 200_000_000, investments: 15_000_000, debts: 50_000_000, creditCards: 3_000_000 })
    expect(nw).toEqual({ assets: 225_000_000, liabilities: 53_000_000, netWorth: 172_000_000 })
  })
  it('dashboard (debtTotal sudah termasuk kartu) = halaman Net Worth (rincian)', () => {
    const p = { liquid: 7_500_000, nonLiquid: 0, investments: 2_000_000, debts: 1_000_000, creditCards: 500_000 }
    const hero = computeNetWorth({ ...p, debts: p.debts + p.creditCards, creditCards: 0 })
    expect(hero.netWorth).toBe(computeNetWorth(p).netWorth)
  })
  it('sumField: null/undefined = 0', () => {
    expect(sumField([{ v: 1 }, { v: null }, {}], 'v')).toBe(1)
    expect(sumField(null, 'v')).toBe(0)
  })
})

describe('transfer antar-rekening', () => {
  const txs = [
    { date: '2026-10-05', type: 'income', amount: 10_000_000, category: 'Gaji' },
    { date: '2026-10-06', type: 'expense', amount: 2_000_000, category: 'Transfer' },
    { date: '2026-10-06', type: 'income', amount: 2_000_000, category: 'Transfer' },
    { date: '2026-10-07', type: 'expense', amount: 1_500_000, category: 'Makan' },
  ]
  it('kedua kaki Transfer tidak menggelembungkan income/expense', () => {
    expect(monthFlow(txs)).toMatchObject({ income: 10_000_000, expense: 1_500_000, net: 8_500_000 })
  })
  it('forecast saldo memakai aturan Transfer yang sama', () => {
    const today = new Date(2026, 9, 31)
    const hist = [...txs, { date: '2026-09-01', type: 'expense', amount: 0, category: 'x' }]
    const avg = computeAvgDailyExpense(hist, new Set(), { today, windowDays: 61 })
    expect(avg).toBeCloseTo(1_500_000 / 61, 6)
  })
  it('income Goals/Net Worth/Utang: rata-rata non-Transfer per bulan distinct', () => {
    expect(averageMonthlyIncome([{ amount: 10_000_000, date: '2026-10-05' }])).toBe(10_000_000)
  })
})

describe('bayar kartu kredit', () => {
  const base = (): Ledger => ({ accounts: { bca: 10_000_000 }, credit_cards: { visa: 3_000_000 }, debts: {} })

  it('penuh: rekening −3jt, kartu 0, net worth tetap', async () => {
    const l = base(); const before = nwOf(l)
    const { client } = fakeDb(l)
    const res = await applyCardPaymentBalances(client, 3_000_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })
    expect(res.ok).toBe(true)
    expect(l).toEqual({ accounts: { bca: 7_000_000 }, credit_cards: { visa: 0 }, debts: {} })
    expect(nwOf(l)).toBe(before)
  })
  it('sebagian: rekening −1jt, kartu 2jt, net worth tetap', async () => {
    const l = base(); const before = nwOf(l)
    await applyCardPaymentBalances(fakeDb(l).client, 1_000_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })
    expect(l.accounts.bca).toBe(9_000_000)
    expect(l.credit_cards.visa).toBe(2_000_000)
    expect(nwOf(l)).toBe(before)
  })
  it('gagal di kartu: rekening dikembalikan via delta (tanpa tulis absolut)', async () => {
    const l = base()
    const { client, calls } = fakeDb(l, 'adjust_credit_card_balance')
    const res = await applyCardPaymentBalances(client, 1_000_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })
    expect(res.ok).toBe(false)
    expect(l).toEqual(base())
    expect(calls.map((c) => [c.fn, c.delta])).toEqual([
      ['adjust_account_balance', -1_000_000],
      ['adjust_credit_card_balance', -1_000_000],
      ['adjust_account_balance', 1_000_000],
    ])
  })
  it('gagal di rekening: kartu tidak disentuh', async () => {
    const l = base()
    const { client, calls } = fakeDb(l, 'adjust_account_balance')
    expect((await applyCardPaymentBalances(client, 1_000_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })).ok).toBe(false)
    expect(calls).toHaveLength(1)
    expect(l).toEqual(base())
  })
  it('dibatalkan (hapus pembayaran): kartu +amount, rekening +amount → kembali semula', async () => {
    const l = base()
    const { client } = fakeDb(l)
    await applyCardPaymentBalances(client, 1_000_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })
    // removePayment: adjustCardBalance(+amount) + adjustAccountBalance(+amount)
    await client.rpc('adjust_credit_card_balance', { p_card: 'visa', p_delta: 1_000_000, p_clamp_zero: false })
    await client.rpc('adjust_account_balance', { p_account: 'bca', p_delta: 1_000_000, p_clamp_zero: false })
    expect(l).toEqual(base())
  })
  it('KETERBATASAN (dilaporkan): bayar lebih dari outstanding → clamp 0, pembatalan melebihkan utang', async () => {
    const l = base()
    const { client } = fakeDb(l)
    await applyCardPaymentBalances(client, 3_500_000, { id: 'visa', current_balance: 3_000_000 }, { id: 'bca', current_balance: 10_000_000 })
    expect(l.credit_cards.visa).toBe(0)
    await client.rpc('adjust_credit_card_balance', { p_card: 'visa', p_delta: 3_500_000, p_clamp_zero: false })
    expect(l.credit_cards.visa).toBe(3_500_000) // seharusnya 3.000.000
  })
})

describe('bayar utang + cicilan', () => {
  it('cicilan mengurangi sisa utang (clamp 0); hapus cicilan mengembalikan', async () => {
    const l: Ledger = { accounts: { bca: 5_000_000 }, credit_cards: {}, debts: { kpr: 1_200_000 } }
    const { client } = fakeDb(l)
    await adjustDebtRemaining(client, 'kpr', -500_000, 1_200_000)
    expect(l.debts.kpr).toBe(700_000)
    await adjustDebtRemaining(client, 'kpr', -900_000, 700_000)
    expect(l.debts.kpr).toBe(0)
    // Kebijakan AGENTS.md: bayar utang TIDAK menyentuh rekening → net worth naik
    // sebesar cicilan sampai user menyesuaikan saldo manual.
    expect(l.accounts.bca).toBe(5_000_000)
  })
})

describe('import mutasi', () => {
  const isCard = (id: string) => id === 'visa'
  it('ke kartu: expense menaikkan outstanding; income/refund tidak', () => {
    const rows = [
      { type: 'expense' as const, account_id: 'visa', amount: 250_000 },
      { type: 'expense' as const, account_id: 'visa', amount: 100_000 },
      { type: 'income' as const, account_id: 'visa', amount: 50_000 },
    ]
    const total = rows.reduce((s, r) => s + (computeCardDeltas(null, r, isCard).visa ?? 0), 0)
    expect(total).toBe(350_000)
    expect(reverseCardDeltas(rows, isCard)).toEqual({ visa: -350_000 })
  })
  it('ke rekening: tidak ada delta kartu (saldo rekening dikelola manual)', () => {
    expect(computeCardDeltas(null, { type: 'expense', account_id: 'bca', amount: 250_000 }, isCard)).toEqual({})
  })
  it('format angka bank Indonesia → rupiah utuh', () => {
    expect(parseFlexibleAmount('1.234.567')).toBe(1_234_567)
    expect(parseFlexibleAmount('Rp 25.000,00')).toBe(25_000)
  })
})

describe('pergantian bulan/tahun + WIB', () => {
  let tz: string | undefined
  beforeAll(() => { tz = process.env.TZ; process.env.TZ = 'Asia/Jakarta' })
  afterAll(() => { process.env.TZ = tz })

  it('01:30 WIB tanggal 1 = tanggal 1 (dulu toISOString → bulan lalu)', () => {
    const d = new Date('2026-10-31T18:30:00Z') // 1 Nov 01:30 WIB
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-31')
    expect(toLocalISO(d)).toBe('2026-11-01')
  })
  it('batas Desember → Januari', () => {
    expect(monthBounds(2026, 12)).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    const txs = [
      { date: '2026-12-31', type: 'expense', amount: 100, category: 'Makan' },
      { date: '2027-01-01', type: 'expense', amount: 200, category: 'Makan' },
    ]
    expect(sumFlow(inMonth(txs, 2026, 12), 'expense')).toBe(100)
    expect(sumFlow(inMonth(txs, 2027, 1), 'expense')).toBe(200)
  })
})

describe('mata uang & pembulatan', () => {
  it('jumlah rupiah integer tetap eksak (tanpa drift float)', () => {
    const txs = Array.from({ length: 1000 }, () => ({ date: '2026-10-01', type: 'expense', amount: 33_333, category: 'x' }))
    expect(sumFlow(txs, 'expense')).toBe(33_333_000)
  })
})

describe('> 1000 transaksi', () => {
  it('total tahunan dari halaman paginated = total sebenarnya', async () => {
    const all = Array.from({ length: 2600 }, (_, i) => ({
      date: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`, type: 'expense', amount: 10_000, category: 'Makan',
    }))
    const { data } = await fetchAllRows(async (f, t) => ({ data: all.slice(f, Math.min(t + 1, f + 1000)), error: null }))
    expect(sumFlow(data, 'expense')).toBe(26_000_000)
    expect(sumFlow(inMonth(data, 2026, 1), 'expense')).toBe(217 * 10_000)
  })
})

// Fake query builder untuk loader yang memanggil supabase.from(...) berantai.
function queryFake(rows: unknown[], error: unknown = null) {
  const calls: string[] = []
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'gte', 'lt', 'order']) {
    builder[m] = (...a: unknown[]) => { calls.push(`${m}:${a.map(String).join(',')}`); return builder }
  }
  builder.range = (f: number, t: number) => Promise.resolve({ data: error ? null : rows.slice(f, t + 1), error })
  builder.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve({ data: error ? null : rows, error }).then(res, rej)
  return { client: { from: () => builder } as unknown as SupabaseClient, calls }
}

describe('anggaran: realisasi & sisa', () => {
  it('realisasi per bulan dijumlah lintas halaman (> 1000 baris)', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ type: 'expense', category: 'Makan', amount: 1000, date: i < 1000 ? '2026-03-10' : '2026-04-10' }))
    const { client } = queryFake(rows)
    const actuals = await loadMonthlyActuals(client, 'u1', '2026')
    expect(actuals['expense::Makan::3']).toBe(1_000_000)
    expect(actuals['expense::Makan::4']).toBe(500_000)
    const budget = 1_200_000
    expect(budget - actuals['expense::Makan::3']).toBe(200_000) // sisa
  })
  it('gagal muat → error (bukan realisasi 0 palsu)', async () => {
    const { client } = queryFake([], { message: 'down' })
    await expect(loadMonthlyActuals(client, 'u1', '2026')).rejects.toEqual({ message: 'down' })
  })
})

describe('Goals: income bulanan', () => {
  it('query exclude Transfer', async () => {
    const { client, calls } = queryFake([{ amount: 9_000_000, date: '2026-10-01' }])
    expect(await fetchMonthlyIncome(client, 'u1')).toBe(9_000_000)
    expect(calls).toContain('neq:category,Transfer')
  })
  it('gagal muat → error (bukan "belum ada pemasukan")', async () => {
    const { client } = queryFake([], { message: 'down' })
    await expect(fetchMonthlyIncome(client, 'u1')).rejects.toEqual({ message: 'down' })
  })
})
