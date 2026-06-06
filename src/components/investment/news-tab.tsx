'use client'

/**
 * Tab Berita di halaman Saham IDX — agregator RSS keyless dari 5 sumber
 * finansial Indonesia (CNBC Indonesia, Detik Finance, Bisnis.com, Kontan,
 * IDX Channel). Fetch ke /api/news (server-side, no API key, cache ~10 menit).
 *
 * Ringan: cuma headline + sumber + waktu relatif, klik buka tab baru ke
 * artikel asli. Gak nyimpen apa-apa, gak butuh data emiten IDX.
 */

import { useEffect, useState } from 'react'
import { Loader2, Newspaper, ExternalLink } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

interface NewsItem {
  source: string
  title: string
  link: string
  pubDate: string
  pubDateMs: number
  description?: string
}

/** Waktu relatif Bahasa Indonesia: "baru saja" / "5 menit lalu" / "3 hari lalu". */
function relativeTimeID(pubDate: string): string {
  const ms = Date.parse(pubDate)
  if (isNaN(ms)) return ''
  const diff = Date.now() - ms
  if (diff < 0) return 'baru saja'
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const jam = Math.floor(min / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.floor(jam / 24)
  if (hari < 7) return `${hari} hari lalu`
  const minggu = Math.floor(hari / 7)
  if (minggu < 5) return `${minggu} minggu lalu`
  const bulan = Math.floor(hari / 30)
  if (bulan < 12) return `${bulan} bulan lalu`
  return `${Math.floor(hari / 365)} tahun lalu`
}

export function NewsTab() {
  const t = useT()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch('/api/news')
      .then((r) => r.json())
      .then((data: { items?: NewsItem[]; error?: boolean }) => {
        if (cancelled) return
        if (data.error || !data.items) {
          setError(true)
          setItems([])
        } else {
          setItems(data.items)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" style={{ color: 'var(--c-mint)' }} />
        {t('news.loading')}
      </div>
    )
  }

  if (error || items.length === 0) {
    return (
      <div className="s-card p-12 text-center">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-2)' }}
        >
          <Newspaper className="size-6" style={{ color: 'var(--ink-muted)' }} />
        </div>
        <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('news.errorTitle')}
        </p>
        <p className="mt-1 text-xs max-w-sm mx-auto" style={{ color: 'var(--ink-muted)' }}>
          {t('news.errorDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="s-card p-0 overflow-hidden">
        <ul>
          {items.map((item, i) => {
            const rel = relativeTimeID(item.pubDate)
            return (
              <li
                key={item.link}
                className="border-t first:border-t-0"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block px-4 py-3.5 transition hover:bg-[var(--surface-2)]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="eyebrow"
                      style={{ color: 'var(--c-mint)' }}
                    >
                      {item.source}
                    </span>
                    {rel && (
                      <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                        · {rel}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-sm font-medium leading-snug group-hover:underline inline-flex items-start gap-1"
                    style={{ color: 'var(--ink)' }}
                  >
                    {item.title}
                    <ExternalLink
                      className="size-3 mt-1 shrink-0 opacity-0 group-hover:opacity-60 transition"
                      style={{ color: 'var(--ink-muted)' }}
                    />
                  </p>
                  {item.description && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--ink-muted)' }}>
                      {item.description}
                    </p>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="text-[11px] text-center px-2" style={{ color: 'var(--ink-soft)' }}>
        {t('news.sourcesPrefix')} CNBC Indonesia · Detik · Bisnis · Kontan · IDX Channel {t('news.updatedEvery')}
      </p>
    </div>
  )
}
