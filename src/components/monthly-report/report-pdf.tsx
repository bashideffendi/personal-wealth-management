'use client'

/**
 * Monthly financial report — PDF document.
 * Vector-based output via @react-pdf/renderer (not screenshot/canvas).
 * A4 portrait, 3 pages: Cover / Summary / Breakdown.
 */

import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'

// ── Types ──────────────────────────────────────────────────────────

export interface ReportTransaction {
  date: string
  type: 'income' | 'expense' | 'saving' | 'investment'
  category: string
  description: string
  amount: number
}

export interface ReportData {
  user_name: string
  period_label: string  // e.g. "Mei 2026"
  generated_at: string  // formatted human-readable
  income: number
  expense: number
  saving: number
  investment: number
  net: number
  saving_rate: number
  tx_count: number
  income_by_category: { name: string; amount: number; pct: number }[]
  expense_by_category: { name: string; amount: number; pct: number }[]
  top_expenses: ReportTransaction[]
  biggest_expense: ReportTransaction | null
  busiest_day: { date: string; count: number; amount: number } | null
}

// ── Styles ─────────────────────────────────────────────────────────
// React-PDF uses a CSS-subset via StyleSheet. No Tailwind here.

const COLORS = {
  burgundy: '#8B1538',
  burgundyDark: '#5C0E25',
  ink: '#0A0A0A',
  inkSoft: '#404040',
  inkMuted: '#737373',
  border: '#E5E5E5',
  bgSoft: '#FAFAFA',
  emerald: '#059669',
  rose: '#E11D48',
  amber: '#D97706',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.ink,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },
  // Cover
  coverPage: {
    fontFamily: 'Helvetica',
    color: COLORS.ink,
    padding: 0,
    backgroundColor: COLORS.burgundyDark,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  coverTopAccent: {
    height: 8,
    backgroundColor: COLORS.amber,
    width: '100%',
  },
  coverInner: {
    flexGrow: 1,
    paddingHorizontal: 56,
    paddingTop: 80,
    paddingBottom: 56,
    color: '#FFFFFF',
  },
  coverEyebrow: {
    fontSize: 10,
    letterSpacing: 4,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  coverTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
    lineHeight: 1.1,
  },
  coverSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 16,
  },
  coverDivider: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.amber,
    marginTop: 32,
    marginBottom: 32,
  },
  coverMeta: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
  },
  coverFooter: {
    paddingHorizontal: 56,
    paddingBottom: 40,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  // Common
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.burgundy,
    paddingBottom: 8,
    marginBottom: 24,
  },
  pageHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  pageHeaderSub: {
    fontSize: 9,
    color: COLORS.inkMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.burgundy,
    marginBottom: 10,
  },
  // Summary KPI grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  kpiCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  kpiCardInner: {
    backgroundColor: COLORS.bgSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
  },
  kpiLabel: {
    fontSize: 8,
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: 'bold',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
    color: COLORS.ink,
  },
  // Tables
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgSoft,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.ink,
  },
  // Highlight callout
  highlight: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.amber,
    padding: 12,
    borderRadius: 4,
    marginTop: 12,
  },
  highlightLabel: {
    fontSize: 8,
    color: '#92400E',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highlightValue: {
    fontSize: 11,
    color: COLORS.ink,
    marginTop: 4,
    fontWeight: 'bold',
  },
  highlightSub: {
    fontSize: 8,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.inkMuted,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
})

// ── Helpers ────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Components ─────────────────────────────────────────────────────

function PageFooter({ pageLabel }: { pageLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>Personal Wealth Management · Laporan dibuat otomatis</Text>
      <Text>{pageLabel}</Text>
    </View>
  )
}

// ── Main Document ──────────────────────────────────────────────────

export function MonthlyReportPDF({ data }: { data: ReportData }) {
  const incomeUp = data.net >= 0
  return (
    <Document
      title={`Laporan Bulanan ${data.period_label} - ${data.user_name}`}
      author={data.user_name}
      subject="Personal Financial Monthly Report"
      creator="Personal Wealth Management"
    >
      {/* COVER */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverTopAccent} />
        <View style={styles.coverInner}>
          <Text style={styles.coverEyebrow}>Laporan Keuangan Pribadi</Text>
          <Text style={styles.coverTitle}>Laporan{'\n'}Bulanan</Text>
          <View style={styles.coverDivider} />
          <Text style={styles.coverSubtitle}>{data.period_label}</Text>
          <Text style={styles.coverMeta}>Disiapkan untuk: {data.user_name}</Text>
          <Text style={styles.coverMeta}>Dibuat: {data.generated_at}</Text>
        </View>
        <View style={styles.coverFooter}>
          <Text>Personal Wealth Management</Text>
          <Text>masbash.id</Text>
        </View>
      </Page>

      {/* SUMMARY */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageHeaderTitle}>Ringkasan</Text>
            <Text style={styles.pageHeaderSub}>{data.period_label} · {data.tx_count} transaksi</Text>
          </View>
          <Text style={styles.pageHeaderSub}>{data.user_name}</Text>
        </View>

        {/* KPI Grid */}
        <View style={styles.section}>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardInner}>
                <Text style={styles.kpiLabel}>Pemasukan</Text>
                <Text style={[styles.kpiValue, { color: COLORS.emerald }]}>{fmtCurrency(data.income)}</Text>
              </View>
            </View>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardInner}>
                <Text style={styles.kpiLabel}>Pengeluaran</Text>
                <Text style={[styles.kpiValue, { color: COLORS.rose }]}>{fmtCurrency(data.expense)}</Text>
              </View>
            </View>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardInner}>
                <Text style={styles.kpiLabel}>Tabungan + Investasi</Text>
                <Text style={[styles.kpiValue, { color: COLORS.amber }]}>{fmtCurrency(data.saving + data.investment)}</Text>
              </View>
            </View>
            <View style={styles.kpiCard}>
              <View style={styles.kpiCardInner}>
                <Text style={styles.kpiLabel}>Net Cashflow</Text>
                <Text style={[styles.kpiValue, { color: incomeUp ? COLORS.emerald : COLORS.rose }]}>
                  {incomeUp ? '+' : ''}{fmtCurrency(data.net)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Saving rate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saving Rate</Text>
          <View style={{
            backgroundColor: COLORS.bgSoft, padding: 16, borderRadius: 6,
            borderWidth: 1, borderColor: COLORS.border,
          }}>
            <Text style={{ fontSize: 36, fontWeight: 'bold', color: COLORS.burgundy }}>
              {data.saving_rate.toFixed(1)}%
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.inkMuted, marginTop: 4 }}>
              Persentase penghasilan yang dialokasikan ke tabungan + investasi.
              Standar finansial sehat: minimal 20%.
            </Text>
          </View>
        </View>

        {/* Highlight: biggest expense */}
        {data.biggest_expense && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pengeluaran Terbesar</Text>
            <View style={styles.highlight}>
              <Text style={styles.highlightLabel}>Single Transaction</Text>
              <Text style={styles.highlightValue}>
                {data.biggest_expense.description || data.biggest_expense.category} —{' '}
                {fmtCurrency(data.biggest_expense.amount)}
              </Text>
              <Text style={styles.highlightSub}>
                {data.biggest_expense.category} · {fmtDate(data.biggest_expense.date)}
              </Text>
            </View>
          </View>
        )}

        {/* Busiest day */}
        {data.busiest_day && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hari Paling Aktif</Text>
            <View style={styles.highlight}>
              <Text style={styles.highlightLabel}>Most Transactions</Text>
              <Text style={styles.highlightValue}>{fmtDate(data.busiest_day.date)}</Text>
              <Text style={styles.highlightSub}>
                {data.busiest_day.count} transaksi · total {fmtCurrency(data.busiest_day.amount)}
              </Text>
            </View>
          </View>
        )}

        <PageFooter pageLabel="Hal. 2 / 3" />
      </Page>

      {/* BREAKDOWN */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageHeaderTitle}>Rincian Per Kategori</Text>
            <Text style={styles.pageHeaderSub}>Breakdown pemasukan & pengeluaran</Text>
          </View>
          <Text style={styles.pageHeaderSub}>{data.period_label}</Text>
        </View>

        {/* Income breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pemasukan</Text>
          {data.income_by_category.length === 0 ? (
            <Text style={{ fontSize: 9, color: COLORS.inkMuted, fontStyle: 'italic' }}>
              Tidak ada pemasukan tercatat.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Kategori</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>%</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Jumlah</Text>
              </View>
              {data.income_by_category.map((row) => (
                <View key={row.name} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{row.name}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: COLORS.inkMuted }]}>
                    {row.pct.toFixed(1)}%
                  </Text>
                  <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', fontWeight: 'bold', color: COLORS.emerald }]}>
                    {fmtCurrency(row.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Expense breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pengeluaran (Top 10)</Text>
          {data.expense_by_category.length === 0 ? (
            <Text style={{ fontSize: 9, color: COLORS.inkMuted, fontStyle: 'italic' }}>
              Tidak ada pengeluaran tercatat.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Kategori</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>%</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>Jumlah</Text>
              </View>
              {data.expense_by_category.slice(0, 10).map((row, i) => (
                <View key={row.name} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 3 }]}>
                    {i + 1}. {row.name}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: COLORS.inkMuted }]}>
                    {row.pct.toFixed(1)}%
                  </Text>
                  <Text style={[styles.tableCell, { flex: 2, textAlign: 'right', fontWeight: 'bold', color: COLORS.rose }]}>
                    {fmtCurrency(row.amount)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Top transactions */}
        {data.top_expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transaksi Pengeluaran Terbesar</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Tanggal</Text>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Deskripsi</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Kategori</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'right' }]}>Jumlah</Text>
            </View>
            {data.top_expenses.slice(0, 10).map((tx, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5, color: COLORS.inkMuted }]}>{fmtDate(tx.date)}</Text>
                <Text style={[styles.tableCell, { flex: 3 }]}>{tx.description || '—'}</Text>
                <Text style={[styles.tableCell, { flex: 2, color: COLORS.inkMuted }]}>{tx.category}</Text>
                <Text style={[styles.tableCell, { flex: 1.8, textAlign: 'right', fontWeight: 'bold' }]}>
                  {fmtCurrency(tx.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter pageLabel="Hal. 3 / 3" />
      </Page>
    </Document>
  )
}
