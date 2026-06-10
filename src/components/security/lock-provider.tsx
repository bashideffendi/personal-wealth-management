'use client'

/**
 * App lock — PIN-based device lock for the dashboard.
 *
 * Why per-device PIN (not server-stored)?
 *   - Locks at the *device* level, not the account. Different devices can
 *     have different PINs, or none at all.
 *   - If a device is stolen, the PIN buys time before they get to
 *     financial data — Supabase session cookie alone isn't enough.
 *   - Resets when user clears site data; fallback = re-login (password).
 *
 * Storage (localStorage):
 *   - klunting:lock-pin-hash  → SHA-256 hex of the PIN (6+ digits)
 *   - klunting:lock-after-min → auto-lock idle threshold in minutes
 *   - klunting:lock-last-active → ISO timestamp of last user activity
 *
 * Activity tracking: any mousedown/keydown/touchstart bumps last-active.
 * An interval checks every 30s if now > last-active + threshold. If yes
 * AND a PIN is set, transition to `locked` state.
 *
 * Auth integration: when the user signs out, PIN stays (per-device). On
 * next sign-in, lock screen still appears if idle threshold passed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

interface LockContextValue {
  /** Is a PIN configured for this device? */
  hasPin: boolean
  /** Is the app currently locked (PIN required to use)? */
  isLocked: boolean
  /** Idle minutes before auto-lock (1-60, default 5). */
  lockAfterMin: number
  /** Is biometric (WebAuthn) enrolled & supported on this device? */
  hasBiometric: boolean
  /** Does this browser/device support WebAuthn platform authenticator? */
  biometricSupported: boolean
  /** Set a new PIN (replaces existing). Returns true on success. */
  setPin: (pin: string) => Promise<boolean>
  /** Remove the PIN entirely (disables locking). Also removes biometric. */
  removePin: (currentPin: string) => Promise<boolean>
  /** Try to unlock with a PIN. Returns true on success. */
  unlock: (pin: string) => Promise<boolean>
  /** Lock the app immediately (user-triggered). */
  lockNow: () => void
  /** Change idle threshold (persists). */
  setLockAfter: (minutes: number) => void
  /** Enroll biometric — verifies PIN first, then registers WebAuthn credential. */
  enrollBiometric: (currentPin: string) => Promise<boolean>
  /** Remove biometric enrollment (PIN stays active). */
  removeBiometric: () => void
  /** Try to unlock via biometric. Returns true on success. */
  unlockBiometric: () => Promise<boolean>
}

const LockContext = createContext<LockContextValue | null>(null)

const KEY_HASH = 'klunting:lock-pin-hash'
const KEY_AFTER = 'klunting:lock-after-min'
const KEY_LAST_ACTIVE = 'klunting:lock-last-active'
const KEY_WEBAUTHN_ID = 'klunting:webauthn-credential-id'

const DEFAULT_AFTER_MIN = 5
const ACTIVITY_THROTTLE_MS = 5000      // don't write storage on every tick
const CHECK_INTERVAL_MS = 30_000        // check idle every 30s

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    if (v == null) return fallback
    return v as unknown as T
  } catch {
    return fallback
  }
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  // Start with `false` for SSR to avoid hydration mismatch; resolve on mount.
  const [hasPin, setHasPin] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockAfterMin, setLockAfterMinState] = useState(DEFAULT_AFTER_MIN)
  const [hasBiometric, setHasBiometric] = useState(false)
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [ready, setReady] = useState(false)

  // Activity timestamp lives in ref so updating it doesn't re-render.
  // Init 0 (bukan Date.now() — impure di render); hydrate effect di bawah
  // langsung ngisi nilai beneran sebelum timer idle mana pun jalan.
  const lastActiveRef = useRef<number>(0)
  const lastWriteRef = useRef<number>(0)

  // ─── Hydrate from localStorage on mount ───────────────────────
  useEffect(() => {
    const storedHash = readStored<string | null>(KEY_HASH, null)
    const storedAfter = parseInt(
      readStored<string>(KEY_AFTER, String(DEFAULT_AFTER_MIN)),
      10,
    )
    const storedLast = parseInt(
      readStored<string>(KEY_LAST_ACTIVE, String(Date.now())),
      10,
    )

    setHasPin(!!storedHash)
    setLockAfterMinState(
      Number.isFinite(storedAfter) && storedAfter > 0 ? storedAfter : DEFAULT_AFTER_MIN,
    )
    lastActiveRef.current = Number.isFinite(storedLast) ? storedLast : Date.now()

    // Detect biometric: has stored credential ID + platform authenticator available
    const credId = readStored<string | null>(KEY_WEBAUTHN_ID, null)
    setHasBiometric(!!credId)

    // Probe WebAuthn platform authenticator (Face ID / Touch ID / Windows Hello)
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      void window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricSupported(!!available))
        .catch(() => setBiometricSupported(false))
    }

    // If PIN is set and idle threshold has passed, lock immediately
    if (storedHash) {
      const idleMs =
        Date.now() -
        (Number.isFinite(storedLast) ? storedLast : Date.now())
      const thresholdMs =
        (Number.isFinite(storedAfter) && storedAfter > 0
          ? storedAfter
          : DEFAULT_AFTER_MIN) *
        60 *
        1000
      if (idleMs >= thresholdMs) setIsLocked(true)
    }

    setReady(true)
  }, [])

  // ─── Bump activity timestamp (throttled write) ────────────────
  const bumpActivity = useCallback(() => {
    const now = Date.now()
    lastActiveRef.current = now
    if (now - lastWriteRef.current >= ACTIVITY_THROTTLE_MS) {
      lastWriteRef.current = now
      try {
        localStorage.setItem(KEY_LAST_ACTIVE, String(now))
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ─── Listen for user activity globally ────────────────────────
  useEffect(() => {
    if (!ready) return
    // Don't track activity while locked — user can't interact anyway,
    // and we don't want PIN keypresses to keep extending the timer pre-unlock.
    if (isLocked) return

    const handler = () => bumpActivity()
    window.addEventListener('mousedown', handler, { passive: true })
    window.addEventListener('keydown', handler, { passive: true })
    window.addEventListener('touchstart', handler, { passive: true })
    window.addEventListener('scroll', handler, { passive: true })
    return () => {
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', handler)
      window.removeEventListener('touchstart', handler)
      window.removeEventListener('scroll', handler)
    }
  }, [bumpActivity, ready, isLocked])

  // ─── Periodic idle check ──────────────────────────────────────
  useEffect(() => {
    if (!ready || !hasPin || isLocked) return
    const id = window.setInterval(() => {
      const idleMs = Date.now() - lastActiveRef.current
      const thresholdMs = lockAfterMin * 60 * 1000
      if (idleMs >= thresholdMs) setIsLocked(true)
    }, CHECK_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [hasPin, isLocked, lockAfterMin, ready])

  // ─── Lock on tab visibility hide (extra safety) ───────────────
  // When user switches tabs / locks phone, immediately mark activity
  // so when they come back it counts from that moment. Pair with
  // a quick re-check on visibility return.
  useEffect(() => {
    if (!ready || !hasPin) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        // Snapshot activity to storage so the next session has a fresh anchor
        try {
          localStorage.setItem(KEY_LAST_ACTIVE, String(lastActiveRef.current))
        } catch {
          /* ignore */
        }
      } else if (document.visibilityState === 'visible' && !isLocked) {
        const idleMs = Date.now() - lastActiveRef.current
        if (idleMs >= lockAfterMin * 60 * 1000) setIsLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [hasPin, isLocked, lockAfterMin, ready])

  // ─── Public API ───────────────────────────────────────────────

  const setPin = useCallback(async (pin: string) => {
    if (!/^\d{4,8}$/.test(pin)) return false
    const hash = await hashPin(pin)
    try {
      localStorage.setItem(KEY_HASH, hash)
    } catch {
      return false
    }
    setHasPin(true)
    // After setting, ensure we're not locked (user just configured it)
    setIsLocked(false)
    bumpActivity()
    return true
  }, [bumpActivity])

  const removePin = useCallback(async (currentPin: string) => {
    const stored = readStored<string | null>(KEY_HASH, null)
    if (!stored) return false
    const candidate = await hashPin(currentPin)
    if (candidate !== stored) return false
    try {
      localStorage.removeItem(KEY_HASH)
      // Removing PIN also nukes biometric — they're tied together
      localStorage.removeItem(KEY_WEBAUTHN_ID)
    } catch {
      /* ignore */
    }
    setHasPin(false)
    setHasBiometric(false)
    setIsLocked(false)
    return true
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const stored = readStored<string | null>(KEY_HASH, null)
    if (!stored) {
      // No PIN set — shouldn't happen but unlock anyway
      setIsLocked(false)
      return true
    }
    const candidate = await hashPin(pin)
    if (candidate !== stored) return false
    setIsLocked(false)
    bumpActivity()
    return true
  }, [bumpActivity])

  const lockNow = useCallback(() => {
    if (hasPin) setIsLocked(true)
  }, [hasPin])

  const setLockAfter = useCallback((minutes: number) => {
    const clamped = Math.max(1, Math.min(60, Math.round(minutes)))
    setLockAfterMinState(clamped)
    try {
      localStorage.setItem(KEY_AFTER, String(clamped))
    } catch {
      /* ignore */
    }
  }, [])

  // ─── Biometric (WebAuthn) ─────────────────────────────────────
  //
  // We use WebAuthn's platform authenticator (Touch ID / Face ID / Windows
  // Hello) as a "fast path" alongside the PIN. The setup:
  //
  //   1. User must have a PIN configured first (biometric = convenience,
  //      not a standalone factor).
  //   2. We register a credential bound to this device. The credential ID
  //      is stored in localStorage so we can present it again for assertion.
  //   3. On unlock, we call navigator.credentials.get() with the stored ID.
  //      The browser/OS handles the actual biometric prompt. If it resolves
  //      successfully, that's proof the device-bound user (e.g. owner's face)
  //      authenticated — we unlock the app.
  //
  // Note: this is client-side-only verification. We don't validate the
  // assertion signature server-side because the lock state is device-local
  // anyway. The threat model is "phone left unattended"; biometric is just
  // a faster PIN.
  const enrollBiometric = useCallback(async (currentPin: string) => {
    // Must have & verify PIN first
    const stored = readStored<string | null>(KEY_HASH, null)
    if (!stored) return false
    const candidate = await hashPin(currentPin)
    if (candidate !== stored) return false

    if (typeof navigator === 'undefined' || !navigator.credentials) return false
    if (!biometricSupported) return false

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      // Random user handle — we don't tie this to the Supabase account because
      // WebAuthn credentials are device-bound, not account-bound. If the user
      // switches accounts on the same device, the credential still works to
      // unlock the *device-level* lock (which is the whole point).
      const userIdBytes = crypto.getRandomValues(new Uint8Array(16))

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Klunting' },
          user: {
            id: userIdBytes,
            name: 'klunting-device-user',
            displayName: 'Klunting',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },    // ES256
            { type: 'public-key', alg: -257 },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60_000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null

      if (!credential) return false

      const idArr = Array.from(new Uint8Array(credential.rawId))
      localStorage.setItem(KEY_WEBAUTHN_ID, JSON.stringify(idArr))
      setHasBiometric(true)
      return true
    } catch (err) {
      // User canceled, browser blocked, no authenticator, etc.
      console.warn('Biometric enrollment failed:', err)
      return false
    }
  }, [biometricSupported])

  const removeBiometric = useCallback(() => {
    try {
      localStorage.removeItem(KEY_WEBAUTHN_ID)
    } catch {
      /* ignore */
    }
    setHasBiometric(false)
  }, [])

  const unlockBiometric = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.credentials) return false
    const raw = readStored<string | null>(KEY_WEBAUTHN_ID, null)
    if (!raw) return false
    try {
      const idArr = JSON.parse(raw) as number[]
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            { type: 'public-key', id: new Uint8Array(idArr) },
          ],
          userVerification: 'required',
          timeout: 60_000,
        },
      })
      if (!assertion) return false
      setIsLocked(false)
      bumpActivity()
      return true
    } catch (err) {
      // User canceled, biometric failed, credential not present, etc.
      console.warn('Biometric unlock failed:', err)
      return false
    }
  }, [bumpActivity])

  return (
    <LockContext.Provider
      value={{
        hasPin,
        isLocked,
        lockAfterMin,
        hasBiometric,
        biometricSupported,
        setPin,
        removePin,
        unlock,
        lockNow,
        setLockAfter,
        enrollBiometric,
        removeBiometric,
        unlockBiometric,
      }}
    >
      {children}
    </LockContext.Provider>
  )
}

export function useLock() {
  const ctx = useContext(LockContext)
  if (!ctx) {
    throw new Error('useLock must be used inside <LockProvider>')
  }
  return ctx
}
