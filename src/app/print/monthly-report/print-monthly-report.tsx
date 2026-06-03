'use client'

/**
 * Print/PDF view — renders the SAME <MonthlyReportBody> as the on-screen
 * report (single source of truth, no more drift). Clean A4 wrapper: toolbar
 * di layar (hidden saat print), konten chrome-free karena /print pakai layout
 * minimal. Tombol "Cetak / Simpan PDF" = window.print().
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, ArrowLeft } from 'lucide-react'
import { MonthlyReportBody } from '@/components/report/monthly-report-body'

interface Props {
  year: number
  month: number
  userId: string
}

export function PrintMonthlyReport({ year, month }: Props) {
  const router = useRouter()
  // Dokumen selalu light — buang kelas dark di tab cetak biar PDF gak gelap.
  useEffect(() => { document.documentElement.classList.remove('dark') }, [])
  return (
    <>
      <style jsx global>{`
        /* Dokumen putih bersih: netralin palet hangat app (krem) jadi putih/abu
           netral & paksa light, biar PDF konsisten walau app lagi dark mode. */
        .report-doc {
          color-scheme: light;
          --bg: #FFFFFF;
          --surface: #FFFFFF;
          --surface-2: #F3F4F6;
          --surface-3: #E9EAEC;
          --line: rgba(0,0,0,0.08);
          --line-strong: rgba(0,0,0,0.14);
          --border-soft: rgba(0,0,0,0.06);
          --ink: #0A0A0F;
          --ink-muted: #3F3F46;
          --ink-soft: #5C5C66;
          --text-mute: #5C5C66;
          background: #FFFFFF;
          color: #0A0A0F;
        }
        /* Dokumen statis: matikan SEMUA blur/filter (Privacy/Calm Mode) biar
           angka & chart gak jadi bubur di PDF. */
        .report-doc,
        .report-doc * { filter: none !important; }
        .report-doc .s-card,
        .report-doc .stat-tile {
          background: #FFFFFF;
          box-shadow: none !important;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
        }
        @media print {
          @page { size: A4 portrait; margin: 16mm 18mm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-paper { max-width: 100% !important; padding: 0 !important; }
          /* lg: breakpoint gak aktif di lebar A4 → paksa grid balik biar gak
             runtuh jadi 1 kolom (chart gepeng + dokumen molor). */
          .report-doc .lg\\:grid-cols-2 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
          .report-doc .lg\\:grid-cols-3 { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 16px !important; }
          .report-doc .lg\\:grid-cols-4 { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 12px !important; }
          .report-doc .lg\\:grid-cols-5 { display: grid !important; grid-template-columns: repeat(5, 1fr) !important; gap: 16px !important; }
          .report-doc .lg\\:col-span-3 { grid-column: span 3 !important; }
          .report-doc .lg\\:col-span-2 { grid-column: span 2 !important; }
          /* Page-break discipline (sebelumnya .print-avoid-break NO-OP) */
          .print-avoid-break,
          .report-doc .print-avoid-break,
          .report-doc .s-card,
          .report-doc .stat-tile { break-inside: avoid; page-break-inside: avoid; }
          .report-doc h1, .report-doc h2, .report-doc h3 { break-after: avoid; }
          .report-doc header { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="min-h-screen report-doc" style={{ background: '#FFFFFF' }}>
        {/* Toolbar — screen only */}
        <div
          className="no-print sticky top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}
        >
          <button onClick={() => router.back()} className="btn-outline inline-flex items-center gap-1.5" style={{ padding: '8px 12px' }}>
            <ArrowLeft className="size-4" /> Kembali
          </button>
          <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-1.5">
            <Printer className="size-4" /> Cetak / Simpan PDF
          </button>
        </div>

        <div className="report-paper mx-auto px-4 sm:px-8 py-6" style={{ maxWidth: 900 }}>
          <MonthlyReportBody year={year} month={month} variant="print" />
        </div>
      </div>
    </>
  )
}
