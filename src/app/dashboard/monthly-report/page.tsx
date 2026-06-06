'use client'

import { useState } from 'react'
import { MONTHS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthlyReportBody } from '@/components/report/monthly-report-body'
import { ReportCustomizer } from '@/components/report/report-customizer'
import { useT } from '@/lib/i18n/context'

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
      {/* Control bar — month nav + PDF (gak ikut ke isi report) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftMonth(-1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label={t('monthly_report.aria_prev_month')}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => shiftMonth(1)} className="btn-outline" style={{ padding: '8px 10px' }} aria-label={t('monthly_report.aria_next_month')}>
            <ChevronRight className="size-4" />
          </button>
        </div>
        <Select value={String(month)} onValueChange={(v) => v && setMonth(Number(v))}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder={t('monthly_report.month_placeholder')}>{(v) => MONTHS[Number(v) - 1] ?? v}</SelectValue></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
          <SelectTrigger className="w-[92px]"><SelectValue placeholder={t('monthly_report.year_placeholder')}>{(v) => v}</SelectValue></SelectTrigger>
          <SelectContent>{yearOpts.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <ReportCustomizer />
        <Button
          onClick={() => window.open(`/print/monthly-report?year=${year}&month=${month}`, '_blank')}
          style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', border: 0 }}
        >
          <Printer className="size-4" data-icon="inline-start" />
          {t('monthly_report.download_pdf')}
        </Button>
      </div>

      <MonthlyReportBody year={year} month={month} variant="screen" />
    </div>
  )
}
