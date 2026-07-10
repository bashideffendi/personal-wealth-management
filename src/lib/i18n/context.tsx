'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { id } from './messages-id'
import type { Locale } from './messages'

const STORAGE_KEY = 'pwm.locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (path: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

// Katalog en dimuat SEKALI saat pertama kali locale = en, lalu di-cache
// module-level (survive re-mount provider). Sebelum resolve, t() fallback ke id
// sebentar — trade-off sadar demi motong ±145KB dari bundle SEMUA halaman
// (mayoritas user berbahasa Indonesia tidak pernah membayar katalog en).
type Catalog = typeof id
let enCache: Catalog | null = null

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id')
  const [enCatalog, setEnCatalog] = useState<Catalog | null>(enCache)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved === 'id' || saved === 'en') {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  useEffect(() => {
    if (locale !== 'en' || enCache) return
    let cancelled = false
    void import('./messages-en').then((m) => {
      enCache = m.en as unknown as Catalog
      if (!cancelled) setEnCatalog(enCache)
    })
    return () => { cancelled = true }
  }, [locale])

  function setLocale(l: Locale) {
    setLocaleState(l)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, l)
      document.documentElement.lang = l
    }
  }

  /**
   * Translate by dot-path: t('nav.dashboard') or t('common.save').
   * Falls back to Indonesian if key missing in English, or returns path if missing entirely.
   */
  function t(path: string): string {
    const parts = path.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (obj: any): string | undefined => {
      let cur = obj
      for (const p of parts) {
        if (cur == null) return undefined
        cur = cur[p]
      }
      return typeof cur === 'string' ? cur : undefined
    }
    const active = locale === 'en' ? (enCatalog ?? id) : id
    return walk(active) ?? walk(id) ?? path
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}

// Shortcut hook returning just t
export function useT() {
  return useI18n().t
}
