'use client'

/**
 * Lock screen overlay — shown when LockProvider.isLocked === true.
 *
 * Renders above everything (z-index 100). User must enter the device PIN
 * to proceed. After 5 failed attempts, shows a "Logout" option as escape hatch
 * (re-auth via password = full reset).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, AlertCircle, Fingerprint, Loader2 } from 'lucide-react'
import { useLock } from './lock-provider'
import { createClient } from '@/lib/supabase/client'

const FAIL_THRESHOLD = 5

export function LockScreen() {
  const router = useRouter()
  const { isLocked, hasPin, hasBiometric, unlock, unlockBiometric } = useLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fails, setFails] = useState(0)
  const [bioBusy, setBioBusy] = useState(false)
  const [autoBioTried, setAutoBioTried] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the input when lock screen appears
  useEffect(() => {
    if (isLocked) {
      // small delay so animation completes
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    } else {
      setPin('')
      setError(null)
      setFails(0)
      setAutoBioTried(false)
    }
  }, [isLocked])

  // Auto-trigger biometric prompt on lock if enrolled. iOS Safari may require
  // a user gesture for the first call after page load, so we also expose the
  // explicit button below as a fallback.
  useEffect(() => {
    if (!isLocked || !hasBiometric || autoBioTried) return
    setAutoBioTried(true)
    void tryBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, hasBiometric, autoBioTried])

  async function tryBiometric() {
    if (bioBusy) return
    setBioBusy(true)
    setError(null)
    const ok = await unlockBiometric()
    setBioBusy(false)
    if (!ok) {
      // Don't surface a noisy error — user can still type the PIN
      // (browser already showed its own cancel/fail UI)
    }
  }

  if (!isLocked || !hasPin) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pin) return
    const ok = await unlock(pin)
    if (!ok) {
      setFails((n) => n + 1)
      setError('PIN salah, coba lagi.')
      setPin('')
      // Haptic feedback on mobile
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(120)
      }
    } else {
      setError(null)
      setFails(0)
    }
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{
        background: 'var(--paper)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="App terkunci"
    >
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <Lock className="size-6" />
          </div>
          <h1
            className="mt-4 text-2xl font-bold tracking-tight"
            style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
          >
            Klunting terkunci
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            Masukin PIN buat lanjutin.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border p-6"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-soft)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          {error && (
            <div
              className="mb-3 rounded-lg border p-2.5 text-sm flex items-center gap-2"
              style={{
                background: 'var(--danger-bg)',
                borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
                color: 'var(--danger)',
              }}
            >
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="\d*"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '')
              setPin(v)
              if (error) setError(null)
            }}
            placeholder="• • • •"
            className="w-full h-12 text-center text-2xl font-mono tracking-[0.6em] rounded-lg border bg-transparent outline-none focus:ring-2"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--ink)',
              // emerald focus ring via tailwind ring-ring class won't work for inline; use boxShadow
              boxShadow: 'none',
            }}
            aria-label="Masukin PIN"
          />

          <button
            type="submit"
            disabled={pin.length < 4}
            className="mt-3 h-11 w-full rounded-lg text-sm font-semibold transition disabled:opacity-50"
            style={{
              background: 'var(--c-primary)',
              color: 'var(--c-primary-foreground)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            Buka
          </button>

          {hasBiometric && (
            <button
              type="button"
              onClick={tryBiometric}
              disabled={bioBusy}
              className="mt-2 h-11 w-full rounded-lg text-sm font-semibold transition border flex items-center justify-center gap-2 disabled:opacity-60"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
              }}
            >
              {bioBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Fingerprint className="size-4" />
              )}
              Buka pakai biometric
            </button>
          )}

          {fails >= FAIL_THRESHOLD && (
            <div
              className="mt-4 pt-4 border-t text-center"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Lupa PIN? Logout & masuk ulang pakai password.
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 text-sm font-semibold hover:underline"
                style={{ color: 'var(--c-coral-ink)' }}
              >
                Keluar dari akun
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
