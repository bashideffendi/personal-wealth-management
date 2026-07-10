'use client'

/**
 * KeyboardShortcuts — pendengar keyboard global (keyboard-first, P3 #3).
 *
 * Pintasan single-key (tanpa modifier):
 *   n            → buka Quick Add (dispatch 'klunting:open-quick-add',
 *                  didengarkan quick-add-launcher.tsx — pola sama dgn
 *                  'klunting:open-command-palette' di command-palette.tsx)
 *   ? (shift+/)  → dialog bantuan berisi daftar pintasan
 *   g lalu huruf → chord lompat halaman (jendela 900 ms):
 *                  t=Transaksi  b=Anggaran  i=Investasi  n=Net Worth
 *                  s=Screener   h=Beranda
 *
 * GUARD ketat — semua pintasan diabaikan bila:
 *   1. Ada modifier meta/ctrl/alt (jangan tabrak ⌘K & pintasan browser).
 *   2. Target sedang mengetik: input / textarea / select / contenteditable
 *      (termasuk komposisi IME via e.isComposing).
 *   3. Ada overlay terbuka. Repo pakai base-ui (BUKAN Radix — gak ada
 *      data-state="open"): popup Dialog/Sheet dapat role="dialog" dan
 *      ter-unmount saat tutup; avatar-menu manual render role="menu"
 *      kondisional; popup Select ([data-slot="select-content"]) juga unmount.
 *      Command palette / lock screen / report+dashboard customizer gak punya
 *      role, tapi SEMUA overlay repo render backdrop `.fixed.inset-0` hanya
 *      saat terbuka — selector gabungan di bawah mendeteksi semuanya.
 *
 * Mobile: gak di-gate viewport — keyboard fisik jarang di mobile dan guard
 * mengetik sudah cukup. Nol perubahan perilaku touch (<md).
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// Tujuan chord "g lalu huruf" — semua route dashboard yang paling sering dituju.
const CHORD_ROUTES: Record<string, string> = {
  t: '/dashboard/transactions',
  b: '/dashboard/budgeting',
  i: '/dashboard/assets/investment',
  n: '/dashboard/net-worth',
  s: '/dashboard/screener',
  h: '/dashboard',
}

// Jendela tunggu huruf kedua chord (ms).
const CHORD_WINDOW_MS = 900

// Deteksi overlay terbuka (lihat catatan guard #3 di atas).
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="menu"], [data-slot="select-content"], .fixed.inset-0'

// Target yang lagi dipakai mengetik — jangan bajak keystroke-nya.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  // isContentEditable sudah memperhitungkan pewarisan dari ancestor
  return target.isContentEditable
}

// Kbd kecil — tiru gaya <kbd> di command-palette.tsx (surface-2 + mono).
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium"
      style={{
        background: 'var(--surface-2)',
        color: 'var(--ink-muted)',
        border: '1px solid var(--border-soft)',
      }}
    >
      {children}
    </kbd>
  )
}

// Satu baris cheat-sheet: label kiri, kombinasi tombol kanan.
function ShortcutRow({
  keys,
  label,
  sep,
}: {
  keys: string[]
  label: string
  sep?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm" style={{ color: 'var(--ink)' }}>
        {label}
      </span>
      <span className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                {sep ?? 'lalu'}
              </span>
            )}
            <Key>{k}</Key>
          </Fragment>
        ))}
      </span>
    </div>
  )
}

// Judul seksi — gaya header tabel dense (11px uppercase tracking ink-soft).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] uppercase tracking-[0.08em] font-semibold pt-2 pb-0.5"
      style={{ color: 'var(--ink-soft)' }}
    >
      {children}
    </p>
  )
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const [helpOpen, setHelpOpen] = useState(false)
  // Indikator chord "g …" di pojok bawah. State buat render badge,
  // ref buat dibaca handler keydown tanpa re-subscribe tiap perubahan.
  const [chordWaiting, setChordWaiting] = useState(false)
  const chordRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelChord = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    chordRef.current = false
    setChordWaiting(false)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Guard #1: modifier & komposisi IME & auto-repeat tombol ditahan
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.isComposing || e.repeat) return
      // Guard #2: lagi mengetik di form
      if (isTypingTarget(e.target)) return
      // Guard #3: ada overlay terbuka (dialog/sheet/menu/palette/lock screen)
      if (document.querySelector(OVERLAY_SELECTOR)) return

      const key = e.key.toLowerCase()
      // Keydown tombol Shift sendiri (persiapan ketik "?") — jangan
      // batalkan chord yang lagi nunggu huruf kedua.
      if (key === 'shift') return

      // Chord aktif: tunggu huruf kedua di jendela 900 ms
      if (chordRef.current) {
        cancelChord()
        const dest = CHORD_ROUTES[key]
        if (dest) {
          e.preventDefault()
          router.push(dest)
        }
        // Huruf lain / Esc = batal diam-diam
        return
      }

      if (key === 'g') {
        e.preventDefault()
        chordRef.current = true
        setChordWaiting(true)
        timerRef.current = setTimeout(cancelChord, CHORD_WINDOW_MS)
        return
      }

      if (key === 'n') {
        e.preventDefault()
        // Open eksplisit (bukan toggle) — pola 'klunting:open-command-palette'
        window.dispatchEvent(new CustomEvent('klunting:open-quick-add'))
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router, cancelChord])

  // Label ⌘K vs Ctrl+K — dihitung saat render dialog (client-only, aman
  // dari hydration karena helpOpen selalu false di render awal).
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

  return (
    <>
      {/* Badge indikator chord — pojok kiri bawah (FAB Quick Add di kanan).
          Auto-hilang saat chord selesai / timeout 900 ms. */}
      {chordWaiting && (
        <div
          className="s-card fixed bottom-6 left-6 z-40 flex items-center gap-1.5 px-2.5 py-1.5 pointer-events-none select-none animate-in fade-in slide-in-from-bottom-2 duration-150"
          aria-hidden="true"
        >
          <Key>g</Key>
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            …
          </span>
        </div>
      )}

      {/* Cheat-sheet — dialog base-ui standar repo (Esc & klik luar nutup
          otomatis). Saat terbuka, role="dialog"-nya sekaligus memblokir
          pintasan lain lewat guard overlay. */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pintasan Keyboard</DialogTitle>
            <DialogDescription>
              Navigasi cepat tanpa mouse. Tekan Esc untuk menutup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid">
            <SectionLabel>Umum</SectionLabel>
            <ShortcutRow keys={[isMac ? '⌘K' : 'Ctrl+K']} label="Palet perintah" />
            <ShortcutRow keys={['n']} label="Transaksi baru (Quick Add)" />
            <ShortcutRow keys={['?']} label="Bantuan pintasan ini" />

            <SectionLabel>Lompat ke halaman</SectionLabel>
            <ShortcutRow keys={['g', 't']} label="Transaksi" />
            <ShortcutRow keys={['g', 'b']} label="Anggaran" />
            <ShortcutRow keys={['g', 'i']} label="Investasi" />
            <ShortcutRow keys={['g', 'n']} label="Net Worth" />
            <ShortcutRow keys={['g', 's']} label="Screener" />
            <ShortcutRow keys={['g', 'h']} label="Beranda" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
