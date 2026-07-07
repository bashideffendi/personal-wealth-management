'use client'

/**
 * OfflineSync — penyapu antrian transaksi offline (lib/offline-queue).
 *
 * Mount sekali di dashboard layout (render null). Nyoba flush:
 *   - saat mount (user balik online lalu buka app lagi)
 *   - saat window event 'online' (sinyal balik)
 *   - tiap 60 detik (jaga-jaga: onLine bisa true tapi request tetap gagal)
 *
 * Kalau ada yang sukses ke-flush → toast "N transaksi offline tersinkron" +
 * dispatch 'klunting:data-changed' biar dashboard/budgeting refetch.
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { flushQueue, getQueued } from '@/lib/offline-queue'

const FLUSH_INTERVAL_MS = 60_000

export function OfflineSync() {
  const { locale } = useI18n()
  // Ref biar effect flush gak perlu re-subscribe tiap ganti bahasa.
  const localeRef = useRef(locale)
  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function sync() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      if (getQueued().length === 0) return
      const { flushed } = await flushQueue(supabase)
      if (cancelled || flushed === 0) return
      toast.success(
        localeRef.current === 'id'
          ? `${flushed} transaksi offline tersinkron`
          : `${flushed} offline transaction${flushed > 1 ? 's' : ''} synced`,
      )
      window.dispatchEvent(new CustomEvent('klunting:data-changed'))
    }

    void sync()
    const onOnline = () => void sync()
    window.addEventListener('online', onOnline)
    const interval = window.setInterval(() => void sync(), FLUSH_INTERVAL_MS)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [])

  return null
}
