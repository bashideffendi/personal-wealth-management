'use client'

/**
 * ProviderCatalog — bottom-sheet katalog provider langganan (F13f).
 * Search + grid avatar-inisial; pilih provider = prefill form recurring.
 * "Lainnya (manual)" = buka form kosong.
 */

import { useMemo, useState } from 'react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import {
  SUBSCRIPTION_PROVIDERS, providerInitials, type SubscriptionProvider,
} from '@/lib/subscription-providers'

export function ProviderCatalog({
  open,
  onOpenChange,
  onPick,
  onManual,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (p: SubscriptionProvider) => void
  onManual: () => void
}) {
  const { locale } = useI18n()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? SUBSCRIPTION_PROVIDERS.filter((p) => p.name.toLowerCase().includes(s)) : SUBSCRIPTION_PROVIDERS
  }, [q])

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => { if (!o) setQ(''); onOpenChange(o) }}
      title={locale === 'en' ? 'Pick a service' : 'Pilih layanan'}
      description={locale === 'en' ? 'Popular subscriptions & bills' : 'Langganan & tagihan populer'}
    >
      <div className="px-1 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none" style={{ color: 'var(--ink-soft)' }} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === 'en' ? 'Search services…' : 'Cari layanan…'}
            className="pl-9"
          />
        </div>
        {filtered.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {filtered.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => onPick(p)}
                className="rounded-xl px-1.5 py-2.5 flex flex-col items-center gap-1.5 transition-colors active:bg-[var(--surface-2)]"
              >
                <span
                  className="size-10 rounded-full grid place-items-center text-[13px] font-semibold text-white select-none"
                  style={{ background: p.color }}
                  aria-hidden
                >
                  {providerInitials(p.name)}
                </span>
                <span className="text-[11px] leading-tight text-center w-full truncate" style={{ color: 'var(--ink-muted)' }}>{p.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-center py-8" style={{ color: 'var(--ink-soft)' }}>
            {locale === 'en' ? 'No match' : 'Gak ketemu'}
          </p>
        )}
        <Button variant="outline" className="w-full" onClick={onManual}>
          <Plus className="h-4 w-4" /> {locale === 'en' ? 'Other (manual)' : 'Lainnya (manual)'}
        </Button>
      </div>
    </BottomSheet>
  )
}
