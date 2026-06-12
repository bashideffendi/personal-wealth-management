'use client'

/**
 * AssetAllocationCard — "Alokasi Kekayaan": komposisi aset (kas / investasi /
 * aset lain) sebagai stacked bar + legend, plus total aset, utang, kekayaan
 * bersih. Jawab "kekayaanku terdiri dari apa" — pelengkap NetWorth hero.
 * Data dari yang sudah dihitung di dashboard (no fetch baru).
 */

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'

export function AssetAllocationCard({
  liquid, nonLiquid, investment, debt,
}: { liquid: number; nonLiquid: number; investment: number; debt: number }) {
  const t = useT()
  const assets = Math.max(0, liquid) + Math.max(0, nonLiquid) + Math.max(0, investment)
  const net = assets - debt
  const seg = [
    { key: 'liquid', label: t('asset_alloc.liquid'), value: Math.max(0, liquid), color: 'var(--c-mint)' },
    { key: 'investment', label: t('asset_alloc.investment'), value: Math.max(0, investment), color: 'var(--sky-500)' },
    { key: 'other', label: t('asset_alloc.other'), value: Math.max(0, nonLiquid), color: 'var(--c-amber)' },
  ].filter((s) => s.value > 0)

  return (
    <article className="s-card flex flex-col h-full" style={{ padding: 24 }}>
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="eyebrow">{t('asset_alloc.title')}</p>
          <p className="num tabular mt-1 truncate" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
            {formatCurrency(net)}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--text-mute)' }}>{t('asset_alloc.net')}</p>
        </div>
        <Link href="/dashboard/net-worth" className="btn-outline shrink-0" style={{ fontSize: 11, padding: '6px 10px' }}>
          {t('asset_alloc.detail')} <ChevronRight className="size-3" />
        </Link>
      </div>

      {assets > 0 && (
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full shrink-0" style={{ background: 'var(--surface-2)' }}>
          {seg.map((s) => (
            <div key={s.key} style={{ width: `${(s.value / assets) * 100}%`, background: s.color }} title={`${s.label}: ${formatCurrency(s.value)}`} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
        {seg.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-[12.5px]">
            <span className="flex items-center gap-2 min-w-0" style={{ color: 'var(--ink-muted)' }}>
              <span className="inline-block size-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="num tabular shrink-0 ml-2" style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {formatCurrency(s.value)} <span style={{ color: 'var(--text-mute)', fontWeight: 400 }}>· {assets > 0 ? Math.round((s.value / assets) * 100) : 0}%</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t space-y-1.5 shrink-0" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: 'var(--ink-muted)' }}>{t('asset_alloc.total_assets')}</span>
          <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrency(assets)}</span>
        </div>
        {debt > 0 && (
          <div className="flex items-center justify-between text-[12px]">
            <span style={{ color: 'var(--ink-muted)' }}>{t('asset_alloc.debt')}</span>
            <span className="num font-semibold" style={{ color: 'var(--c-coral)' }}>−{formatCurrency(debt)}</span>
          </div>
        )}
      </div>
    </article>
  )
}
