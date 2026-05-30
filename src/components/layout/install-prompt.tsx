'use client'

/**
 * PWA install prompt — bottom sheet that nudges users to install Klunting on home screen.
 *
 * Two paths:
 * 1. Android / desktop Chrome: listen for `beforeinstallprompt`, show "Pasang" button
 *    that calls prompt() directly. One tap → installed.
 * 2. iOS Safari: Apple doesn't support beforeinstallprompt, so we sniff UA and
 *    show manual instructions ("Tap Share → Tambah ke Layar Utama").
 *
 * Dismissal is persisted to localStorage so we don't pester the user.
 * Re-shows after 14 days if still not installed.
 */
import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

const STORAGE_KEY = 'pwm-install-dismissed-at'
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // matchMedia covers Android Chrome + desktop. iOS uses navigator.standalone.
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - iOS-only property
    window.navigator.standalone === true
  )
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  // iPad on iOS 13+ reports as Mac, so also check for touch + maxTouchPoints.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in document)
  )
}

function wasRecentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0)
    if (!ts) return false
    return Date.now() - ts < REMIND_AFTER_MS
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [iosMode, setIosMode] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return

    // Android / Chromium path
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Wait a beat so the user sees the dashboard first, then nudge
      setTimeout(() => setShow(true), 4000)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS path — no event, just sniff and show after delay
    if (isIOS()) {
      setIosMode(true)
      const t = setTimeout(() => setShow(true), 6000)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed bottom-20 md:bottom-6 inset-x-0 z-40 px-4 pointer-events-none animate-in slide-in-from-bottom duration-500"
      role="dialog"
      aria-label="Pasang aplikasi Klunting"
    >
      <div
        className="pointer-events-auto mx-auto max-w-sm rounded-2xl border shadow-2xl"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)',
              boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
            }}
          >
            <Download className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Pasang Klunting di HP
            </p>
            {iosMode ? (
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Buka tab{' '}
                <Share className="inline size-3.5 align-text-bottom mx-0.5" />{' '}
                <strong>Bagikan</strong> di Safari, lalu pilih{' '}
                <strong>“Tambah ke Layar Utama”</strong>.
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                Akses cepat dari layar utama, fullscreen tanpa address bar.
              </p>
            )}

            {!iosMode && deferredPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98]"
                style={{
                  background: 'var(--c-primary)',
                  color: 'var(--c-primary-foreground)',
                  boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
                }}
              >
                Pasang sekarang
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-lg p-1.5 transition hover:opacity-70"
            style={{ color: 'var(--ink-soft)' }}
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
