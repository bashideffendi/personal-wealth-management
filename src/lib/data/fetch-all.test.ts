import { describe, expect, it } from 'vitest'
import { fetchAllRows } from './fetch-all'

// Tiruan PostgREST: potong di `cap` baris per request (max_rows), tanpa error.
function fakeTable(total: number, cap = 1000) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i, amount: 1 }))
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('di bawah 1 halaman: satu request', async () => {
    const t = fakeTable(10)
    const res = await fetchAllRows(t.page)
    expect(res.data).toHaveLength(10)
    expect(t.calls).toEqual([[0, 999]])
  })

  it('lebih dari 1000 baris: semua terbaca (bug cap 1000 PostgREST)', async () => {
    const t = fakeTable(2500)
    const res = await fetchAllRows(t.page)
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(2500)
    expect(res.data.reduce((s, r) => s + r.amount, 0)).toBe(2500)
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('tepat kelipatan halaman: berhenti di halaman kosong', async () => {
    const t = fakeTable(2000)
    const res = await fetchAllRows(t.page)
    expect(res.data).toHaveLength(2000)
    expect(t.calls).toHaveLength(3)
  })

  it('halaman gagal: error, tanpa data parsial', async () => {
    let n = 0
    const res = await fetchAllRows(async () => {
      n++
      return n === 1
        ? { data: Array.from({ length: 1000 }, () => ({ amount: 1 })), error: null }
        : { data: null, error: { message: 'boom' } }
    })
    expect(res.error).toEqual({ message: 'boom' })
    expect(res.data).toEqual([])
  })
})
