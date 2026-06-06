'use client'

/**
 * DashboardCustomizer — "Atur" = tampilkan/sembunyikan section dashboard.
 *
 * URUTAN section di-drag LANGSUNG di dashboard (lihat SortableSection in-place);
 * di sini cuma toggle tampil/sembunyi. Default SEMUA tampil — gak ada yg ke-hide
 * sepihak (belajar dari kejadian tab). Tiap section punya `data-block="id"`;
 * yang disembunyiin di-`display:none` via <style> yg di-inject di sini.
 *
 * Prefs di localStorage (instant) + mirror DB ui_prefs.dashboardHidden (lintas-perangkat).
 */

import { useEffect, useRef, useState } from 'react'
import { Settings2, X, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { loadUiPrefs, saveUiPref } from '@/lib/ui-prefs'
import { useT } from '@/lib/i18n/context'

export interface DashBlock {
  id: string
  label: string
}

const LS_KEY = 'pwm.dashboard.hidden'

/** Section dashboard yang bisa di-toggle. id HARUS sama dengan data-block di page. */
export const DASHBOARD_BLOCKS: DashBlock[] = [
  { id: 'kpi', label: 'Ringkasan KPI (Pemasukan / Pengeluaran / dll)' },
  { id: 'ai-insights', label: 'Insight AI' },
  { id: 'aliran', label: 'Aliran Uang (Sankey)' },
  { id: 'aktivitas', label: 'Transaksi · Tagihan · Tujuan' },
  { id: 'kalender', label: 'Kalender Aktivitas & Progress Anggaran' },
  { id: 'grafik', label: 'Grafik (Kategori / Hari / Saving Rate)' },
  { id: 'insights', label: 'Insight & Peringatan' },
  { id: 'investasi', label: 'Grafik Bulanan & Alokasi Investasi' },
]

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function DashboardCustomizer() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readHidden(),
  )
  const [ready, setReady] = useState(false)
  const touchedRef = useRef(false)

  useEffect(() => {
    setReady(true)
    // Hydrate dari DB (lintas-perangkat) — best-effort, override localStorage.
    void (async () => {
      if (touchedRef.current) return // user udah toggle → jangan ketimpa DB
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const prefs = await loadUiPrefs(supabase, user.id)
      if (prefs && Array.isArray(prefs.dashboardHidden) && !touchedRef.current) {
        setHidden(prefs.dashboardHidden)
        try { localStorage.setItem(LS_KEY, JSON.stringify(prefs.dashboardHidden)) } catch { /* ignore */ }
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
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await saveUiPref(supabase, user.id, { dashboardHidden: next })
    })()
  }
  function toggle(id: string) {
    persist(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  }

  const hiddenCount = hidden.length

  return (
    <>
      {/* Wrapper kosong (komponen self-hide / null) → collapse. Selalu aktif. */}
      <style dangerouslySetInnerHTML={{ __html: '[data-block]:empty{display:none!important}' }} />
      {/* Sembunyiin block terpilih. Cuma setelah mount (default: semua tampil, gak ada flash). */}
      {ready && hiddenCount > 0 && (
        <style
          dangerouslySetInnerHTML={{
            __html: hidden.map((id) => `[data-block="${id}"]{display:none!important}`).join(''),
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-outline inline-flex items-center gap-1.5"
        style={{ padding: '7px 12px', fontSize: 13 }}
      >
        <Settings2 className="size-4" />
        {t('dashboard_customizer.trigger')}
        {hiddenCount > 0 && (
          <span className="num" style={{ color: 'var(--text-mute)' }}>· {hiddenCount} {t('dashboard_customizer.hidden_count_suffix')}</span>
        )}
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
                <p className="eyebrow" style={{ color: 'var(--c-primary)' }}>{t('dashboard_customizer.modal_eyebrow')}</p>
                <h2 className="t-h2" style={{ color: 'var(--ink)' }}>{t('dashboard_customizer.modal_title')}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('dashboard_customizer.close_aria')}>
                <X className="size-5" style={{ color: 'var(--text-mute)' }} />
              </button>
            </div>
            <p className="t-sm mb-4" style={{ color: 'var(--ink-soft)' }}>
              {t('dashboard_customizer.modal_desc_1')}
              <strong> {t('dashboard_customizer.modal_desc_strong')}</strong>{t('dashboard_customizer.modal_desc_2')}
            </p>
            <div className="space-y-1.5">
              {DASHBOARD_BLOCKS.map((b) => {
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
                    <span className="t-sm" style={{ color: on ? 'var(--ink)' : 'var(--text-mute)' }}>
                      {b.label}
                    </span>
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
                <RotateCcw className="size-3.5" /> {t('dashboard_customizer.show_all')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
