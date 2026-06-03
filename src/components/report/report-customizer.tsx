'use client'

/**
 * Custom Report — pilih section mana yang muncul di laporan (layar + PDF).
 * Pola sama kayak DashboardCustomizer: tiap section dikasih data-report-block,
 * yang disembunyiin di-display:none via <style>. Default SEMUA tampil.
 *
 * - <ReportHiddenStyle/> di-mount DI DALAM MonthlyReportBody → kepake di layar
 *   maupun PDF (print route baca localStorage yang sama saat dibuka).
 * - <ReportCustomizer/> (tombol + panel) di-mount di control bar layar aja.
 * Prefs di localStorage (per-perangkat).
 */

import { useEffect, useRef, useState } from 'react'
import { Settings2, X, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadUiPrefs, saveUiPref } from '@/lib/ui-prefs'

export interface ReportBlock {
  id: string
  label: string
}

const LS_KEY = 'pwm.report.hidden'
const EVT = 'klunting:report-prefs'

export const REPORT_BLOCKS: ReportBlock[] = [
  { id: 'aliran', label: 'Aliran Uang (Sankey)' },
  { id: 'perbandingan', label: 'Perbandingan 6 Bulan + Pergeseran' },
  { id: 'anggaran', label: 'Anggaran vs Realisasi' },
  { id: 'kategori', label: 'Pengeluaran per Kategori + Pemasukan per Sumber' },
  { id: 'networth', label: 'Net Worth + Tujuan' },
  { id: 'kewajiban', label: 'Kewajiban Bulan Depan' },
  { id: 'sorotan', label: 'Sorotan Bulan Ini' },
  { id: 'langkah', label: 'Langkah Berikutnya' },
  { id: 'top10', label: 'Transaksi Terbesar (Top 10)' },
]

export function readReportHidden(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Inject hide-CSS dari prefs. Mount di dalam body (layar + PDF). */
export function ReportHiddenStyle() {
  const [hidden, setHidden] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const sync = () => setHidden(readReportHidden())
    sync()
    setReady(true)
    window.addEventListener(EVT, sync)
    return () => window.removeEventListener(EVT, sync)
  }, [])
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: '[data-report-block]:empty{display:none!important}' }} />
      {ready && hidden.length > 0 && (
        <style
          dangerouslySetInnerHTML={{
            __html: hidden.map((id) => `[data-report-block="${id}"]{display:none!important}`).join(''),
          }}
        />
      )}
    </>
  )
}

/** Tombol + panel — mount di control bar layar (bukan di PDF). */
export function ReportCustomizer() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return readReportHidden()
  })
  const touchedRef = useRef(false)
  useEffect(() => {
    void (async () => {
      if (touchedRef.current) return // user udah toggle → jangan ketimpa DB
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const prefs = await loadUiPrefs(supabase, user.id)
      if (prefs && Array.isArray(prefs.reportHidden)) {
        setHidden(prefs.reportHidden)
        try { localStorage.setItem(LS_KEY, JSON.stringify(prefs.reportHidden)) } catch { /* ignore */ }
        window.dispatchEvent(new Event(EVT))
      }
    })()
  }, [])
  function persist(next: string[]) {
    touchedRef.current = true // tandai user udah interaksi → blok hydrate DB
    setHidden(next)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVT))
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await saveUiPref(supabase, user.id, { reportHidden: next })
    })()
  }
  function toggle(id: string) {
    persist(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  }
  const hiddenCount = hidden.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline inline-flex items-center gap-1.5"
        style={{ padding: '7px 12px', fontSize: 13 }}
      >
        <Settings2 className="size-4" />
        Atur isi
        {hiddenCount > 0 && <span className="num" style={{ color: 'var(--text-mute)' }}>· −{hiddenCount}</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="s-card w-full max-w-md p-5 sm:p-6"
            style={{ maxHeight: '82vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="eyebrow" style={{ color: 'var(--c-primary)' }}>Atur Laporan</p>
                <h2 className="t-h2" style={{ color: 'var(--ink)' }}>Section yang ditampilkan</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup">
                <X className="size-5" style={{ color: 'var(--text-mute)' }} />
              </button>
            </div>
            <p className="t-sm mb-4" style={{ color: 'var(--ink-soft)' }}>
              Pilih section yang muncul di laporan — berlaku di layar &amp; PDF. KPI &amp; Ringkasan
              Eksekutif selalu tampil. Tersimpan di perangkat ini.
            </p>
            <div className="space-y-1.5">
              {REPORT_BLOCKS.map((b) => {
                const on = !hidden.includes(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggle(b.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition"
                    style={{
                      background: on ? 'var(--c-primary-soft)' : 'var(--surface-2)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <span className="t-sm" style={{ color: on ? 'var(--ink)' : 'var(--text-mute)' }}>{b.label}</span>
                    {on ? (
                      <Eye className="size-4 shrink-0" style={{ color: 'var(--c-primary)' }} />
                    ) : (
                      <EyeOff className="size-4 shrink-0" style={{ color: 'var(--text-mute)' }} />
                    )}
                  </button>
                )
              })}
            </div>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => persist([])}
                className="mt-4 inline-flex items-center gap-1.5 t-sm font-medium"
                style={{ color: 'var(--c-primary)' }}
              >
                <RotateCcw className="size-3.5" /> Tampilkan semua
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
