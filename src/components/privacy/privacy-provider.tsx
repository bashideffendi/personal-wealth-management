'use client'

/**
 * Privacy Mode — global "hide numbers" toggle.
 *
 * Common in Indonesian banking apps (BCA mobile, Jenius, Jago) — users
 * tap an eye icon to mask their balances/amounts when looking at the
 * app in public (cafe, public transport).
 *
 * Persisted to localStorage so the choice survives reloads. Doesn't
 * sync across devices intentionally — privacy is a per-device setting.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface PrivacyContextValue {
  hidden: boolean
  toggle: () => void
  setHidden: (v: boolean) => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)
const STORAGE_KEY = 'pwm-privacy-hidden'

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false)

  // Read initial state on mount (avoid SSR hydration mismatch by starting false)
  useEffect(() => {
    try {
      setHiddenState(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      /* ignore */
    }
  }, [])

  // Mirror state to body data-attribute so CSS can blur all .num elements
  // globally without per-component wiring. See globals.css for the rule.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (hidden) document.body.setAttribute('data-privacy', 'hidden')
    else document.body.removeAttribute('data-privacy')
  }, [hidden])

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v)
    try {
      localStorage.setItem(STORAGE_KEY, String(v))
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setHidden(!hidden)
  }, [hidden, setHidden])

  return (
    <PrivacyContext.Provider value={{ hidden, toggle, setHidden }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext)
  // Don't throw if outside provider — return a no-op so components are safe
  // to use anywhere. Useful for /print routes that bypass the provider.
  if (!ctx) return { hidden: false, toggle: () => {}, setHidden: () => {} }
  return ctx
}

/**
 * Wrapper that hides its children when privacy mode is on, replacing them
 * with a "•••" mask. Use it around any number that should be maskable:
 *
 *   <Hidden>{formatCurrency(account.balance)}</Hidden>
 *
 * The mask preserves rough character width so layouts don't shift.
 */
export function Hidden({
  children,
  mask = '•••••••',
  className,
}: {
  children: React.ReactNode
  mask?: string
  className?: string
}) {
  const { hidden } = usePrivacy()
  if (hidden) {
    return <span className={`tabular ${className ?? ''}`}>{mask}</span>
  }
  return <>{children}</>
}

/**
 * Mask a string (typically a `title` tooltip or `aria-label`) when privacy
 * mode is on. Browser tooltips and screen readers don't respect CSS blur,
 * so any sensitive text passed via these attributes leaks even when the
 * visible UI is blurred.
 *
 * Usage:
 *   const maskedTitle = useMaskedText(`Saldo: ${formatCurrency(amount)}`)
 *   <div title={maskedTitle}>...</div>
 */
export function useMaskedText(text: string, mask = '••••••'): string {
  const { hidden } = usePrivacy()
  return hidden ? mask : text
}
