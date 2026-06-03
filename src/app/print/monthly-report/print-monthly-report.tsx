'use client'

/**
 * Print/PDF view — renders the SAME <MonthlyReportBody> as the on-screen
 * report (single source of truth, no more drift). Clean A4 wrapper: toolbar
 * di layar (hidden saat print), konten chrome-free karena /print pakai layout
 * minimal. Tombol "Cetak / Simpan PDF" = window.print().
 */

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
  return (
    <>
      <style jsx global>{`
        /* Gaya dokumen: ratakan kartu web jadi flat biar kebaca sebagai laporan,
           bukan screenshot. Preview di layar = hasil PDF. */
        .report-paper .s-card,
        .report-paper .stat-tile {
          box-shadow: none !important;
          border: 1px solid var(--line-strong);
          border-radius: 10px;
        }
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-paper { max-width: 100% !important; padding: 0 !important; }
          /* Jangan motong kartu di tengah halaman */
          .report-paper .s-card,
          .report-paper .stat-tile { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
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
