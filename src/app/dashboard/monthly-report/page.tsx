'use client'

import { useState } from 'react'
import { MONTHS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ReportCustomizer } from '@/components/report/report-customizer'
import { useT } from '@/lib/i18n/context'

// Defer the report body (recharts bar + sankey) out of the screen route's
// initial JS. The /print route keeps its static import so PDF rendering is
// unaffected.
const MonthlyReportBody = dynamic(
  () => import('@/components/report/monthly-report-body').then((m) => m.MonthlyReportBody),
  { ssr: false, loading: () => <div className="animate-pulse rounded-xl" style={{ height: 420, background: 'var(--surface-2)' }} aria-hidden="true" /> },
)

export default function MonthlyReportPage() {
  const t = useT()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const yearOpts = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  return (
    <div className="space-y-5">
      {/* Judul report ("Laporan Mei") hidup di MonthlyReportBody — komponen
          shared dengan route /print (dokumen PDF), jadi t-display-nya gak
          bisa diubah langsung tanpa nyenggol layout print. Override ter-scope
          route layar ini aja: <sm judul dikompres ke app-bar 20px font-display
          600 (standar chrome mobile). /print render dokumen sendiri → gak kena. */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@media (max-width:639px){.report-flow>header .t-display{font-family:var(--font-display);font-size:20px;font-weight:600;letter-spacing:-0.02em;line-height:1.15}}',
        }}
      />

      {/* Control bar — month nav + PDF (gak ikut ke isi report).
          Mobile: baris 1 = chevron + bulan + tahun, baris 2 = Atur isi +
          Unduh PDF rata kanan. Desktop (sm+): satu baris rata kanan spt semula. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => shiftMonth(-1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label={t('monthly_report.aria_prev_month')}>
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label={t('monthly_report.aria_next_month')}>
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[120px]"><SelectValue placeholder={t('monthly_report.month_placeholder')}>{(v) => MONTHS[Number(v) - 1] ?? v}</SelectValue></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
            <SelectTrigger className="w-[92px] shrink-0"><SelectValue placeholder={t('monthly_report.year_placeholder')}>{(v) => v}</SelectValue></SelectTrigger>
            <SelectContent>{yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <ReportCustomizer />
          <Button
            onClick={() => window.open(`/print/monthly-report?year=${year}&month=${month}`, '_blank')}
            style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}
          >
            <Printer className="size-4" data-icon="inline-start" />
            {t('monthly_report.download_pdf')}
          </Button>
        </div>
      </div>

      <MonthlyReportBody year={year} month={month} variant="screen" />
    </div>
  )
}
