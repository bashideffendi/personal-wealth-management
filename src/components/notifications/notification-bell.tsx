'use client'

/**
 * NotificationBell — bell top nav jadi INBOX in-app (migrasi 067 +
 * cron watchlist-alerts). Menggantikan tombol mati "Notifikasi (segera)".
 *
 * Pola dropdown ngikutin AvatarMenu/NavDropdown (manual: useState +
 * klik-luar + Escape — bukan base-ui Menu, alasan sama). Data via
 * TanStack Query ['notifications'] staleTime 60 dtk; RLS "notif select
 * own" yang nge-scope ke user login.
 *
 * DEFENSIF: error apa pun (termasuk migrasi 067 belum diapply → tabel
 * belum ada) → bell tetap render tanpa dot, popover isi
 * "Belum ada notifikasi". Gak ada yang crash.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  url: string | null
  created_at: string
  read_at: string | null
}

interface NotificationData {
  rows: NotificationRow[]
  unread: number
}

const EMPTY: NotificationData = { rows: [], unread: 0 }

/** Waktu relatif ringkas bahasa Indonesia — "2 j lalu", "5 mnt lalu". */
function waktuRelatif(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'baru saja'
  const mnt = Math.floor(diffMs / 60_000)
  if (mnt < 60) return `${mnt} mnt lalu`
  const jam = Math.floor(mnt / 60)
  if (jam < 24) return `${jam} j lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 7) return `${hari} hr lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery<NotificationData>({
    queryKey: ['notifications'],
    staleTime: 60_000,
    queryFn: async () => {
      try {
        // 20 terbaru + hitung unread (head count — gak narik baris).
        const [listRes, countRes] = await Promise.all([
          supabase
            .from('notifications')
            .select('id, title, body, url, created_at, read_at')
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .is('read_at', null),
        ])
        // Tabel belum ada / RLS / error lain → state kosong, bukan crash.
        if (listRes.error) return EMPTY
        return {
          rows: (listRes.data ?? []) as NotificationRow[],
          unread: countRes.error ? 0 : (countRes.count ?? 0),
        }
      } catch {
        return EMPTY
      }
    },
  })

  const rows = data?.rows ?? []
  const unread = data?.unread ?? 0

  // Close on outside click + Escape (pola AvatarMenu)
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markRead(ids: string[]) {
    if (ids.length === 0) return
    try {
      // RLS "notif update own" — cuma baris milik sendiri yang kena.
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', ids)
    } catch {
      // Defensif — gagal nandain gak boleh mecahin UI.
    }
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  function onItemClick(n: NotificationRow) {
    setOpen(false)
    if (!n.read_at) void markRead([n.id])
    if (n.url) router.push(n.url)
  }

  function markAllRead() {
    void markRead(rows.filter((n) => !n.read_at).map((n) => n.id))
  }

  return (
    // hidden md:block — mobile TANPA bell (perilaku lama dipertahankan).
    <div ref={containerRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid place-items-center transition-colors duration-150 cursor-pointer"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: '1px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--text-2)',
        }}
        aria-label={unread > 0 ? `Notifikasi (${unread} belum dibaca)` : 'Notifikasi'}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Notifikasi"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      >
        <Bell className="size-3.5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              top: 8,
              right: 9,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--accent)',
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifikasi"
          className="s-card absolute right-0 top-full mt-2 w-[320px] overflow-hidden z-50"
        >
          <div
            className="flex items-center justify-between px-3 py-2.5 border-b"
            style={{ borderColor: 'var(--border-soft)' }}
          >
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              Notifikasi
            </p>
            {unread > 0 && (
              <span
                className="num tabular text-[11px] font-semibold px-1.5 py-px rounded-full"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
              >
                {unread} baru
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs" style={{ color: 'var(--ink-muted)' }}>
              Belum ada notifikasi
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {rows.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onItemClick(n)}
                  className="block w-full px-3 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-2)] cursor-pointer"
                  style={{
                    background: n.read_at ? 'transparent' : 'var(--surface-2)',
                    borderTop: i ? '1px solid var(--border-soft)' : 'none',
                  }}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className="text-[13px] font-semibold truncate"
                      style={{ color: 'var(--ink)' }}
                    >
                      {n.title}
                    </span>
                    <span
                      className="text-[11px] shrink-0"
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      {waktuRelatif(n.created_at)}
                    </span>
                  </span>
                  {n.body && (
                    <span
                      className="mt-0.5 block text-[12px] leading-snug"
                      style={{
                        color: 'var(--ink-muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {n.body}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {rows.some((n) => !n.read_at) && (
            <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
              <button
                type="button"
                onClick={markAllRead}
                className="text-[12px] font-medium transition-colors duration-100 hover:underline cursor-pointer"
                style={{ color: 'var(--accent)' }}
              >
                Tandai semua dibaca
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
