'use client'

/**
 * Print-optimized monthly report — designed for A4 portrait.
 *
 * Looks like a real financial document, not a printed-out web page:
 *   - Cover header with PWM monogram, period, owner name, generated date
 *   - Executive summary (4 KPI metrics) in a tight strip
 *   - Income breakdown table with category × amount × %
 *   - Expense breakdown table (same)
 *   - Saving + Investment compact table
 *   - Top 10 transactions table
 *   - Footer with timestamp + "Halaman X" placeholder (browser fills via @page)
 *
 * On screen: renders inside a centered "paper" preview with a sticky toolbar.
 * On print: toolbar hidden, body becomes white, A4 sized, no app chrome.
 *
 * No charts — they don't translate to print well at small sizes. Tables and
 * numbers tell the story. The dashboard is for charts; this is for archive.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { MONTHS } from '@/lib/constants'
import type { Transaction } from '@/types'
import { Loader2, Printer, ArrowLeft } from 'lucide-react'

interface Props {
  year: number
  month: number
  userId: string
}

interface UserState { name: string; email: string }

export function PrintMonthlyReport({ year, month, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserState | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  async function load() {
    setLoading(true)
    const profRes = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    const authRes = await supabase.auth.getUser()
    const u = authRes.data.user
    setUser({
      name:
        ((profRes.data as { full_name: string } | null)?.full_name?.trim() ||
          u?.email?.split('@')[0] ||
          'Pengguna'),
      email: u?.email ?? '',
    })

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endMonth = month === 12 ? 1 : month + 1
    const endYear = month === 12 ? year + 1 : year
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true })

    setTxs((data ?? []) as Transaction[])
    setLoading(false)
  }

  const recap = useMemo(() => {
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = txs.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = txs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
    const net = income - expense - saving - investment
    const savingRate = income > 0 ? ((saving + investment) / income) * 100 : 0
    const expenseRate = income > 0 ? (expense / income) * 100 : 0

    function bucket(kind: 'income' | 'expense' | 'saving' | 'investment') {
      const map: Record<string, { amount: number; count: number }> = {}
      for (const t of txs.filter((x) => x.type === kind)) {
        const c = (t.category || 'Lainnya').trim() || 'Lainnya'
        if (!map[c]) map[c] = { amount: 0, count: 0 }
        map[c].amount += t.amount
        map[c].count += 1
      }
      const total = Object.values(map).reduce((s, v) => s + v.amount, 0)
      return Object.entries(map)
        .map(([name, v]) => ({ name, amount: v.amount, count: v.count, pct: total > 0 ? (v.amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount)
    }

    const topExpenses = txs
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    return {
      income, expense, saving, investment, net, savingRate, expenseRate,
      incomeRows: bucket('income'),
      expenseRows: bucket('expense'),
      savingRows: bucket('saving'),
      investmentRows: bucket('investment'),
      topExpenses,
    }
  }, [txs])

  const periodLabel = `${MONTHS[month - 1]} ${year}`
  const generatedDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="size-6 animate-spin mr-2" /> Menyiapkan laporan…
      </div>
    )
  }

  return (
    <div className="print-shell">
      {/* PRINT-ONLY CSS — A4 portrait, no margins on @page (we pad inside the
          paper container so colors/borders bleed cleanly). Hide the toolbar. */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 14mm 12mm;
        }
        body {
          background: #E5E7EB;  /* preview gray bg */
        }
        .print-shell {
          min-height: 100vh;
          padding: 24px 0 96px;
        }
        .preview-toolbar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: rgba(17, 24, 39, 0.92);
          backdrop-filter: blur(8px);
          color: #fff;
          padding: 10px 16px;
          border-radius: 12px;
          margin: 0 auto 24px;
          max-width: 210mm;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .preview-toolbar h1 {
          font-size: 13px;
          font-weight: 600;
          margin: 0;
        }
        .preview-toolbar p {
          font-size: 11px;
          color: #9CA3AF;
          margin: 0;
        }
        .preview-toolbar button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .preview-toolbar button:active {
          transform: scale(0.97);
        }
        .preview-toolbar a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 8px;
          color: #D1D5DB;
          font-size: 12px;
          text-decoration: none;
          background: rgba(255,255,255,0.06);
        }

        /* The "paper" — looks like an A4 sheet on screen, full bleed on print */
        .paper {
          background: #fff;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 16mm 14mm;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.15);
          color: #111827;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          font-size: 10.5pt;
          line-height: 1.45;
        }

        @media print {
          body { background: #fff; }
          .preview-toolbar { display: none !important; }
          .print-shell { padding: 0; }
          .paper {
            width: auto; min-height: auto; margin: 0; padding: 0;
            box-shadow: none;
          }
          /* Force colored backgrounds in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pg-break { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
        }

        /* Report-internal styles — scoped to .paper to avoid affecting other pages */
        .paper .doc-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 14px;
          border-bottom: 2px solid #111827;
        }
        .paper .doc-monogram {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, #10B981, #059669);
          color: #fff;
          font-weight: 800;
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -0.06em;
        }
        .paper .doc-title {
          font-size: 22pt;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1;
        }
        .paper .doc-period {
          font-size: 11pt;
          color: #4B5563;
          margin-top: 4px;
        }
        .paper .doc-meta {
          font-size: 9pt;
          color: #4B5563;
          text-align: right;
        }

        .paper h2.section {
          font-size: 11pt;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #111827;
          margin: 18px 0 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #E5E7EB;
        }

        .paper .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 12px;
        }
        .paper .kpi {
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
        }
        .paper .kpi-label {
          font-size: 8pt;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .paper .kpi-value {
          font-size: 13pt;
          font-weight: 700;
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }
        .paper .kpi.income { background: rgba(16,185,129,0.06); border-color: rgba(16,185,129,0.30); }
        .paper .kpi.expense { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.30); }
        .paper .kpi.saving { background: rgba(245,158,11,0.07); border-color: rgba(245,158,11,0.30); }
        .paper .kpi.net.positive { background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.30); }
        .paper .kpi.net.negative { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.30); }

        .paper table.report {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin-top: 4px;
        }
        .paper table.report th {
          text-align: left;
          font-size: 8pt;
          font-weight: 600;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 6px 8px;
          border-bottom: 1px solid #D1D5DB;
        }
        .paper table.report th.num,
        .paper table.report td.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .paper table.report td {
          padding: 6px 8px;
          border-bottom: 1px solid #F3F4F6;
        }
        .paper table.report tr:last-child td { border-bottom: none; }
        .paper table.report tfoot td {
          padding-top: 8px;
          border-top: 2px solid #111827;
          font-weight: 700;
          background: #F9FAFB;
        }
        .paper .row-bar {
          display: inline-block;
          height: 6px;
          border-radius: 3px;
          margin-left: 6px;
          vertical-align: middle;
        }
        .paper .empty {
          padding: 16px;
          text-align: center;
          color: #9CA3AF;
          font-style: italic;
          font-size: 10pt;
          border: 1px dashed #E5E7EB;
          border-radius: 6px;
        }
        .paper .footer {
          margin-top: 24px;
          padding-top: 10px;
          border-top: 1px solid #E5E7EB;
          font-size: 8.5pt;
          color: #6B7280;
          display: flex;
          justify-content: space-between;
        }
      `}</style>

      {/* Preview-only toolbar */}
      <div className="preview-toolbar">
        <a href={`/dashboard/monthly-report?year=${year}&month=${month}`} onClick={(e) => { e.preventDefault(); router.push(`/dashboard/monthly-report?year=${year}&month=${month}`) }}>
          <ArrowLeft className="size-3.5" />
          Kembali
        </a>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1>Pratinjau Laporan</h1>
          <p>{periodLabel}</p>
        </div>
        <button onClick={() => window.print()}>
          <Printer className="size-3.5" />
          Cetak / Simpan PDF
        </button>
      </div>

      {/* The actual report */}
      <div className="paper">
        <header className="doc-header avoid-break">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="doc-monogram">P</div>
            <div>
              <h1 className="doc-title">Laporan Bulanan</h1>
              <p className="doc-period">{periodLabel}</p>
            </div>
          </div>
          <div className="doc-meta">
            <p style={{ fontWeight: 600, color: '#111827', margin: 0 }}>{user?.name}</p>
            {user?.email && <p style={{ margin: '2px 0 0' }}>{user.email}</p>}
            <p style={{ margin: '6px 0 0' }}>Dibuat: {generatedDate}</p>
          </div>
        </header>

        {/* Summary KPI strip */}
        <h2 className="section">Ringkasan</h2>
        <div className="summary-grid avoid-break">
          <div className="kpi income">
            <div className="kpi-label">Pemasukan</div>
            <div className="kpi-value">{formatCurrency(recap.income)}</div>
          </div>
          <div className="kpi expense">
            <div className="kpi-label">Pengeluaran</div>
            <div className="kpi-value">{formatCurrency(recap.expense)}</div>
          </div>
          <div className="kpi saving">
            <div className="kpi-label">Tabungan + Investasi</div>
            <div className="kpi-value">{formatCurrency(recap.saving + recap.investment)}</div>
          </div>
          <div className={`kpi net ${recap.net >= 0 ? 'positive' : 'negative'}`}>
            <div className="kpi-label">Arus Kas Net</div>
            <div className="kpi-value">{formatCurrency(recap.net)}</div>
          </div>
        </div>

        <p style={{ fontSize: 9, color: '#6B7280', marginTop: 8 }}>
          Pengeluaran {recap.expenseRate.toFixed(1)}% dari pemasukan ·
          Saving rate {recap.savingRate.toFixed(1)}% ({txs.length} transaksi)
        </p>

        {/* Income */}
        <h2 className="section">Pemasukan</h2>
        {recap.incomeRows.length === 0 ? (
          <div className="empty">Tidak ada pemasukan tercatat di {periodLabel}.</div>
        ) : (
          <table className="report avoid-break">
            <thead>
              <tr>
                <th>Kategori</th>
                <th className="num">Transaksi</th>
                <th className="num">Jumlah</th>
                <th className="num" style={{ width: 80 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {recap.incomeRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{formatCurrency(r.amount)}</td>
                  <td className="num">
                    {r.pct.toFixed(1)}%
                    <span className="row-bar" style={{ width: Math.min(50, r.pct * 0.5), background: '#10B981' }} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{recap.incomeRows.reduce((s, r) => s + r.count, 0)}</td>
                <td className="num">{formatCurrency(recap.income)}</td>
                <td className="num">100%</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Expense */}
        <h2 className="section">Pengeluaran</h2>
        {recap.expenseRows.length === 0 ? (
          <div className="empty">Tidak ada pengeluaran tercatat.</div>
        ) : (
          <table className="report avoid-break">
            <thead>
              <tr>
                <th>Kategori</th>
                <th className="num">Transaksi</th>
                <th className="num">Jumlah</th>
                <th className="num" style={{ width: 80 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {recap.expenseRows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="num">{r.count}</td>
                  <td className="num">{formatCurrency(r.amount)}</td>
                  <td className="num">
                    {r.pct.toFixed(1)}%
                    <span className="row-bar" style={{ width: Math.min(50, r.pct * 0.5), background: '#EF4444' }} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{recap.expenseRows.reduce((s, r) => s + r.count, 0)}</td>
                <td className="num">{formatCurrency(recap.expense)}</td>
                <td className="num">100%</td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Saving + Investment */}
        {(recap.saving > 0 || recap.investment > 0) && (
          <>
            <h2 className="section">Tabungan & Investasi</h2>
            <table className="report avoid-break">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Tipe</th>
                  <th className="num">Transaksi</th>
                  <th className="num">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {recap.savingRows.map((r) => (
                  <tr key={`s-${r.name}`}>
                    <td>{r.name}</td>
                    <td><span style={{ background: 'rgba(245,158,11,0.16)', color: '#92400E', padding: '1px 8px', borderRadius: 999, fontSize: 8.5, fontWeight: 600 }}>Tabungan</span></td>
                    <td className="num">{r.count}</td>
                    <td className="num">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
                {recap.investmentRows.map((r) => (
                  <tr key={`i-${r.name}`}>
                    <td>{r.name}</td>
                    <td><span style={{ background: 'rgba(14,165,233,0.14)', color: '#075985', padding: '1px 8px', borderRadius: 999, fontSize: 8.5, fontWeight: 600 }}>Investasi</span></td>
                    <td className="num">{r.count}</td>
                    <td className="num">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="num">{recap.savingRows.reduce((s, r) => s + r.count, 0) + recap.investmentRows.reduce((s, r) => s + r.count, 0)}</td>
                  <td className="num">{formatCurrency(recap.saving + recap.investment)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {/* Top Expenses */}
        {recap.topExpenses.length > 0 && (
          <>
            <h2 className="section">Top 10 Pengeluaran</h2>
            <table className="report">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Tanggal</th>
                  <th>Deskripsi</th>
                  <th>Kategori</th>
                  <th className="num">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {recap.topExpenses.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td>{t.description || <span style={{ color: '#9CA3AF',  }}>(tanpa deskripsi)</span>}</td>
                    <td style={{ color: '#6B7280' }}>{t.category}</td>
                    <td className="num">{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="footer">
          <span>Dibuat dengan Klunting — {generatedDate}</span>
          <span>{user?.name} · {periodLabel}</span>
        </div>
      </div>
    </div>
  )
}
