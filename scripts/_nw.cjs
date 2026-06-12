// One-shot: net-worth — tombol jujur, hapus kamera kedua, error state, tokenisasi.
const fs = require('fs')
let fails = 0
function patch(file, subs) {
  let s = fs.readFileSync(file, 'utf8')
  for (const [from, to, all] of subs) {
    if (!s.includes(from)) { console.error('MISS [' + file + ']: ' + String(from).slice(0, 64)); fails++; continue }
    s = all ? s.split(from).join(to) : s.replace(from, to)
  }
  fs.writeFileSync(file, s)
  console.log('ok:', file)
}

const P = 'src/app/dashboard/net-worth/page.tsx'
patch(P, [
  // imports: react-query + RefreshCw (Camera keluar)
  ["import { useEffect, useMemo, useState } from 'react'",
   "import { useEffect, useMemo, useState } from 'react'\nimport { useQuery, useQueryClient } from '@tanstack/react-query'"],
  ["import { Loader2, TrendingUp, TrendingDown, Camera, Sparkles, History } from 'lucide-react'",
   "import { Loader2, TrendingUp, TrendingDown, RefreshCw, Sparkles, History } from 'lucide-react'"],
  // Tombol header: "Snapshot manual" itu placebo (snapshot udah otomatis tiap
  // load) — ganti jadi "Perbarui" yang jujur (refetch).
  ["          <Button onClick={takeManualSnapshot} disabled={snapshotting}>\n            {snapshotting ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : <Camera className=\"h-4 w-4\" />} {t('networth.manual_snapshot')}\n          </Button>",
   "          <Button onClick={() => pageQuery.refetch()} disabled={pageQuery.isFetching}>\n            {pageQuery.isFetching ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : <RefreshCw className=\"h-4 w-4\" />} {t('networth.refresh')}\n          </Button>"],
  // HistoryCard: props snapshot + tombol kamera kedua dihapus
  ["        <NetWorthHistoryCard snapshots={snapshots} period={period} onPeriodChange={setPeriod} onSnapshot={takeManualSnapshot} snapshotting={snapshotting} />",
   "        <NetWorthHistoryCard snapshots={snapshots} period={period} onPeriodChange={setPeriod} />"],
  ["interface HistoryProps {\n  snapshots: NetWorthSnapshot[]\n  period: '3m' | '6m' | '12m' | 'all'\n  onPeriodChange: (p: '3m' | '6m' | '12m' | 'all') => void\n  onSnapshot: () => void\n  snapshotting: boolean\n}",
   "interface HistoryProps {\n  snapshots: NetWorthSnapshot[]\n  period: '3m' | '6m' | '12m' | 'all'\n  onPeriodChange: (p: '3m' | '6m' | '12m' | 'all') => void\n}"],
  ["function NetWorthHistoryCard({ snapshots, period, onPeriodChange, onSnapshot, snapshotting }: HistoryProps) {",
   "function NetWorthHistoryCard({ snapshots, period, onPeriodChange }: HistoryProps) {"],
  ["          <Button variant=\"outline\" size=\"sm\" onClick={onSnapshot} disabled={snapshotting} className=\"ml-1\">\n            {snapshotting ? <Loader2 className=\"size-3.5 animate-spin\" /> : <Camera className=\"size-3.5\" />}\n          </Button>\n", ''],
  // Error state setelah loading
  ["  if (loading) {\n    return <div className=\"flex items-center justify-center py-20\"><Loader2 className=\"size-6 animate-spin\" /></div>\n  }",
   "  if (loading) {\n    return <div className=\"flex items-center justify-center py-20\"><Loader2 className=\"size-6 animate-spin\" /></div>\n  }\n  if (pageQuery.isError) {\n    return (\n      <div className=\"s-card flex flex-col items-center text-center py-14 px-8 gap-3\">\n        <p className=\"text-sm\" style={{ color: 'var(--ink-muted)' }}>{t('common.load_failed')}</p>\n        <Button variant=\"outline\" onClick={() => pageQuery.refetch()}>{t('common.retry')}</Button>\n      </div>\n    )\n  }"],
  // ── Tokenisasi ──
  // Palet komposisi: tanpa coral (reserved buat loss); kelas minor pakai ink shades
  ["    { label: t('networth.class_investment'), value: data.longTermInvestment, color: '#8B5CF6' },\n    { label: t('networth.class_cash'), value: data.cashAndEquivalent, color: '#10B981' },\n    { label: t('networth.class_property'), value: data.property, color: '#F59E0B' },\n    { label: t('networth.class_vehicle'), value: data.vehicle, color: '#6366F1' },\n    { label: t('networth.class_personal_item'), value: data.personalItem, color: '#F43F5E' },\n    { label: t('networth.class_receivable'), value: data.receivable, color: '#14B8A6' },",
   "    { label: t('networth.class_investment'), value: data.longTermInvestment, color: 'var(--c-violet)' },\n    { label: t('networth.class_cash'), value: data.cashAndEquivalent, color: 'var(--c-mint)' },\n    { label: t('networth.class_property'), value: data.property, color: 'var(--c-amber)' },\n    { label: t('networth.class_vehicle'), value: data.vehicle, color: 'var(--ink)' },\n    { label: t('networth.class_personal_item'), value: data.personalItem, color: 'var(--ink-soft)' },\n    { label: t('networth.class_receivable'), value: data.receivable, color: 'var(--c-mint-ink)' },"],
  // Proyeksi
  ["  const projAccent = nwStrategy === 'snowball' ? '#10B981' : '#8B5CF6'", "  const projAccent = nwStrategy === 'snowball' ? 'var(--c-mint)' : 'var(--c-violet)'"],
  ["style={{ background: nwStrategy === s ? (s === 'snowball' ? '#10B981' : '#8B5CF6') : 'var(--surface-2)', color: nwStrategy === s ? '#FFF' : 'var(--ink)' }}",
   "style={{ background: nwStrategy === s ? (s === 'snowball' ? 'var(--c-mint)' : 'var(--c-violet)') : 'var(--surface-2)', color: nwStrategy === s ? '#FFF' : 'var(--ink)' }}"],
  ["<p className=\"num text-sm font-semibold mt-0.5\" style={{ color: '#10B981' }}>{formatCurrency(projection.endNetWorth)}</p>", "<p className=\"num text-sm font-semibold mt-0.5\" style={{ color: 'var(--c-mint-ink)' }}>{formatCurrency(projection.endNetWorth)}</p>"],
  ["<p className=\"num text-sm font-semibold mt-0.5\" style={{ color: '#10B981' }}>+{formatCurrency(projection.endNetWorth - projection.startNetWorth)}</p>", "<p className=\"num text-sm font-semibold mt-0.5\" style={{ color: 'var(--c-mint-ink)' }}>+{formatCurrency(projection.endNetWorth - projection.startNetWorth)}</p>"],
  // Rincian: header + subtotal + total — teks pakai -ink
  ["uppercase\" style={{ color: '#10B981' }}>{t('networth.asset_breakdown')}", "uppercase\" style={{ color: 'var(--c-mint-ink)' }}>{t('networth.asset_breakdown')}"],
  ["uppercase\" style={{ color: '#F43F5E' }}>{t('networth.liabilities_breakdown')}", "uppercase\" style={{ color: 'var(--c-coral-ink)' }}>{t('networth.liabilities_breakdown')}"],
  ['value={totalCurrentAssets} color="#10B981"', 'value={totalCurrentAssets} color="var(--c-mint)" ink="var(--c-mint-ink)"'],
  ['value={totalNonCurrentAssets} color="#10B981"', 'value={totalNonCurrentAssets} color="var(--c-mint)" ink="var(--c-mint-ink)"'],
  ['value={totalCurrentDebt} color="#F43F5E" neg', 'value={totalCurrentDebt} color="var(--c-coral)" ink="var(--c-coral-ink)" neg'],
  ['value={data.longTermDebt} color="#F43F5E" neg', 'value={data.longTermDebt} color="var(--c-coral)" ink="var(--c-coral-ink)" neg'],
  ["<span className=\"num font-bold\" style={{ color: '#10B981' }}>{formatCurrency(totalAssets)}</span>", "<span className=\"num font-bold\" style={{ color: 'var(--c-mint-ink)' }}>{formatCurrency(totalAssets)}</span>"],
  ["<span className=\"num font-bold\" style={{ color: '#F43F5E' }}>{totalDebt > 0 ? `\\u2212${formatCurrency(totalDebt)}` : formatCurrency(0)}</span>", "<span className=\"num font-bold\" style={{ color: 'var(--c-coral-ink)' }}>{totalDebt > 0 ? `\\u2212${formatCurrency(totalDebt)}` : formatCurrency(0)}</span>"],
  // SubtotalRow: bg color-mix + teks ink
  ["function SubtotalRow({ label, value, color, neg = false }: { label: string; value: number; color: string; neg?: boolean }) {\n  return (\n    <div className=\"flex items-center justify-between mt-1.5 rounded-md px-2 py-1.5\" style={{ background: `${color}0F` }}>\n      <span className=\"text-[12px] font-medium\" style={{ color: 'var(--ink)' }}>{label}</span>\n      <span className=\"num text-[12px] font-semibold\" style={{ color }}>{neg && value > 0 ? '\\u2212' : ''}{formatCurrency(value)}</span>\n    </div>\n  )\n}",
   "function SubtotalRow({ label, value, color, ink, neg = false }: { label: string; value: number; color: string; ink: string; neg?: boolean }) {\n  return (\n    <div className=\"flex items-center justify-between mt-1.5 rounded-md px-2 py-1.5\" style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>\n      <span className=\"text-[12px] font-medium\" style={{ color: 'var(--ink)' }}>{label}</span>\n      <span className=\"num text-[12px] font-semibold\" style={{ color: ink }}>{neg && value > 0 ? '\\u2212' : ''}{formatCurrency(value)}</span>\n    </div>\n  )\n}"],
  // Rasio + ChangeStat + Sparkles
  ["const c = r.value === '\\u2014' ? 'var(--ink-soft)' : r.ok ? '#10B981' : '#F59E0B'", "const c = r.value === '\\u2014' ? 'var(--ink-soft)' : r.ok ? 'var(--c-mint-ink)' : 'var(--c-amber-ink)'"],
  ["  const color = positive ? '#10B981' : '#F43F5E'", "  const color = positive ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)'"],
  ["<Sparkles className=\"size-7 mx-auto mb-2 opacity-50\" style={{ color: '#10B981' }} />", "<Sparkles className=\"size-7 mx-auto mb-2 opacity-50\" style={{ color: 'var(--c-mint)' }} />"],
  // DTI: cicilan bulanan / income bulanan (konsisten halaman Utang) — bukan utang/income-tahunan
  ["        <HealthRatiosCard\n          liquidAssets={totalCurrentAssets}\n          totalAssets={totalAssets}\n          totalDebt={totalDebt}\n          currentDebt={totalCurrentDebt}\n          investmentValue={data.longTermInvestment}\n          netWorth={netWorth}\n          monthlyIncome={monthlyIncome}\n        />",
   "        <HealthRatiosCard\n          liquidAssets={totalCurrentAssets}\n          totalAssets={totalAssets}\n          totalDebt={totalDebt}\n          currentDebt={totalCurrentDebt}\n          investmentValue={data.longTermInvestment}\n          netWorth={netWorth}\n          monthlyIncome={monthlyIncome}\n          monthlyDebtPayment={payoffDebts.reduce((s, d) => s + (d.monthly_payment || 0), 0)}\n        />"],
  ["function HealthRatiosCard({ liquidAssets, totalAssets, totalDebt, currentDebt, investmentValue, netWorth, monthlyIncome }: {\n  liquidAssets: number; totalAssets: number; totalDebt: number; currentDebt: number; investmentValue: number; netWorth: number; monthlyIncome: number\n}) {",
   "function HealthRatiosCard({ liquidAssets, totalAssets, totalDebt, currentDebt, investmentValue, netWorth, monthlyIncome, monthlyDebtPayment }: {\n  liquidAssets: number; totalAssets: number; totalDebt: number; currentDebt: number; investmentValue: number; netWorth: number; monthlyIncome: number; monthlyDebtPayment: number\n}) {"],
  ["  const dti = monthlyIncome > 0 ? (totalDebt / (monthlyIncome * 12)) * 100 : null",
   "  // DTI yang bener: CICILAN bulanan / penghasilan bulanan (konsisten dgn\n  // halaman Utang). Rumus lama (total utang / penghasilan setahun) itu metrik\n  // beda yang dipajang pakai label & ambang DTI.\n  const dti = monthlyIncome > 0 ? (monthlyDebtPayment / monthlyIncome) * 100 : null"],
])

const M = 'src/lib/i18n/messages.ts'
patch(M, [
  ['      manual_snapshot: "', '      refresh: "Perbarui",\n      manual_snapshot: "'],
])
{
  let s = fs.readFileSync(M, 'utf8')
  const needle = '      manual_snapshot: "'
  const first = s.indexOf(needle)
  const second = s.indexOf(needle, first + 1)
  if (second > 0 && !s.slice(second - 40, second).includes('refresh:')) {
    s = s.slice(0, second) + '      refresh: "Refresh",\n' + s.slice(second)
    fs.writeFileSync(M, s)
    console.log('ok: EN refresh')
  } else if (second < 0) { console.error('MISS: EN manual_snapshot kedua'); fails++ }
}

process.exit(fails > 0 ? 1 : 0)
