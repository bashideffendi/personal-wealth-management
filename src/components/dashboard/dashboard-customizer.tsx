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
import { loadUiPrefs, saveUiPref, DASHBOARD_LAYOUT_VERSION } from '@/lib/ui-prefs'
import { useT } from '@/lib/i18n/context'

export interface DashBlock {
  id: string
  /** i18n leaf under `dashboard_customizer.*` for the section label. */
  labelKey: string
}

const LS_KEY = 'pwm.dashboard.hidden.v2'

/** Tidak ada yang default-hidden lagi — kartu low-value (saving-ring, top-kategori,
 *  hari-aktif, proyeksi) sudah DIHAPUS dari dashboard, bukan sekadar disembunyiin. */
const DEFAULT_HIDDEN: string[] = []

/** Section dashboard yang bisa di-toggle. id HARUS sama dengan data-block di page. */
// Urutan = default visual order yg dipilih supaya bento-grid (dense) pack rapi
// tanpa celah: Sankey & kalender di atas, lalu kartu kecil numpuk di channel
// sebelah kalender + sebelah grafik tahunan. Lihat page.tsx packing.
export const DASHBOARD_BLOCKS: DashBlock[] = [
  { id: 'aliran', labelKey: 'block_aliran' },
  { id: 'kalender', labelKey: 'block_kalender' },
  { id: 'akun', labelKey: 'block_akun' },
  { id: 'arus-tahunan', labelKey: 'block_arus_tahunan' },
  { id: 'portofolio', labelKey: 'block_portofolio' },
  { id: 'transaksi', labelKey: 'block_transaksi' },
  { id: 'tagihan', labelKey: 'block_tagihan' },
  { id: 'sisa-aman', labelKey: 'block_sisa_aman' },
  { id: 'tujuan', labelKey: 'block_tujuan' },
  { id: 'anggaran', labelKey: 'block_anggaran' },
  { id: 'insights', labelKey: 'block_insights' },
  { id: 'langganan', labelKey: 'block_langganan' },
  { id: 'kesehatan', labelKey: 'block_kesehatan' },
  { id: 'cash-coverage', labelKey: 'block_cash_coverage' },
  { id: 'ai-insights', labelKey: 'block_ai_insights' },
  { id: 'alokasi', labelKey: 'block_alokasi' },
]

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw == null) return [...DEFAULT_HIDDEN]
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [...DEFAULT_HIDDEN]
  } catch {
    return [...DEFAULT_HIDDEN]
  }
}

export function DashboardCustomizer() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  // Fokus masuk ke dialog saat buka; balik ke tombol pemicu saat tutup.
  useEffect(() => {
    if (open) closeRef.current?.focus()
    else triggerRef.current?.focus({ preventScroll: true })
  }, [open])
  const [hidden, setHidden] = useState<string[]>(() =>
    typeof window === 'undefined' ? [...DEFAULT_HIDDEN] : readHidden(),
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
      if (prefs && Array.isArray(prefs.dashboardHidden) && prefs.dashboardLayoutVersion === DASHBOARD_LAYOUT_VERSION && !touchedRef.current) {
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
      if (user) await saveUiPref(supabase, user.id, { dashboardHidden: next, dashboardLayoutVersion: DASHBOARD_LAYOUT_VERSION })
    })()
  }
  function toggle(id: string) {
    persist(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id])
  }

  const hiddenCount = hidden.length

  return (
    <>
      {/* Wrapper kosong (komponen self-hide / null) → collapse. Selalu aktif. */}
      {/* Sembunyiin block terpilih. Cuma setelah mount (default: semua tampil, gak ada flash). */}
      {ready && hiddenCount > 0 && (
        <style
          dangerouslySetInnerHTML={{
            __html: hidden.map((id) => `[data-block="${id}"]{display:none!important}`).join(''),
          }}
        />
      )}

      <button
        ref={triggerRef}
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
          role="dialog"
          aria-modal="true"
          aria-label={t('dashboard_customizer.modal_title')}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        >
          <div
            className="s-card w-full max-w-md p-5 sm:p-6"
            style={{ maxHeight: '82vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <p className="eyebrow" style={{ color: 'var(--c-primary-ink)' }}>{t('dashboard_customizer.modal_eyebrow')}</p>
                <h2 className="t-h2" style={{ color: 'var(--ink)' }}>{t('dashboard_customizer.modal_title')}</h2>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t('dashboard_customizer.close_aria')}>
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
                    aria-pressed={on}
                    onClick={() => toggle(b.id)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition"
                    style={{
                      background: on ? 'var(--c-primary-soft)' : 'var(--surface-2)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <span className="t-sm" style={{ color: on ? 'var(--ink)' : 'var(--text-mute)' }}>
                      {t(`dashboard_customizer.${b.labelKey}`)}
                    </span>
                    {on ? (
                      <Eye className="size-4 shrink-0" style={{ color: 'var(--c-primary-ink)' }} />
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
                style={{ color: 'var(--c-primary-ink)' }}
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
