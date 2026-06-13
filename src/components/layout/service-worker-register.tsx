'use client'

/**
 * Registers /sw.js once on app boot, and renders a tiny "offline" pill
 * at the top of the viewport whenever the network drops.
 *
 * - Skips registration in dev (Next.js dev server doesn't play well with
 *   stale SW caches; you'd be debugging cached HTML constantly).
 * - Listens to navigator.onLine + online/offline events for the indicator.
 * - When a new SW is installed and waiting, posts SKIP_WAITING so the
 *   next page load picks up the new version automatically.
 */

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function ServiceWorkerRegister() {
  const [offline, setOffline] = useState(false)

  // Register the SW once
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // If a new SW is already waiting, take over immediately
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          }
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing
            if (!installing) return
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch(() => {
          // Registration failed — non-fatal, app still works online
        })
    }

    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
  }, [])

  // Track online/offline status for the indicator
  useEffect(() => {
    if (typeof window === 'undefined') return
    setOffline(!navigator.onLine)
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-[var(--card-shadow)] animate-in slide-in-from-top duration-300"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#FCA5A5',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="size-3.5" />
      <span>Offline — pakai data tersimpan</span>
    </div>
  )
}
