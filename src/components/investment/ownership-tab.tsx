'use client'

/**
 * Tab "Struktur Kepemilikan" — jaring kepemilikan emiten (ownership network).
 *
 * Tiga blok: graf relasi lintas-emiten (Sigma, client-only island) + komposisi
 * pemegang saham (bar horizontal) + daftar anak usaha. Buat lihat siapa
 * pengendali & kepemilikan silang antar emiten (pihak terkait) — flavour audit.
 *
 * Sigma touches `window`, jadi grafnya di-load lewat next/dynamic ssr:false
 * (mirror pola Soto map di src/components/map/map-client.tsx).
 */

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { Network, Building2, Users, UserRound } from 'lucide-react'
import { formatTanggalID, formatIDRCompact } from '@/lib/invest/format'
import { useT } from '@/lib/i18n/context'
import type { Ownership } from '@/lib/invest/ownership'

// Island: Sigma graph cuma di-mount di client.
const OwnershipGraph = dynamic(() => import('./ownership-graph'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border text-xs"
      style={{
        height: 440,
        background: 'var(--surface-2)',
        borderColor: 'var(--border-soft)',
        color: 'var(--ink-soft)',
      }}
    >
      Memuat graf kepemilikan…
    </div>
  ),
})

// Skala warna emerald → makin kecil makin pudar (komposisi pemegang saham).
function barColor(rank: number, total: number): string {
  // rank 0 (terbesar) = mint penuh; ekor = abu.
  const t = total <= 1 ? 0 : rank / (total - 1)
  if (t < 0.15) return 'var(--c-mint)'
  if (t < 0.4) return '#34D399'
  if (t < 0.7) return '#A7F3D0'
  return 'var(--surface-2)'
}

// Format jumlah lembar saham compact ala Indonesia: 1,23 M (juta) / 26,45 B (miliar) / 1,02 T (triliun).
function formatShares(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')
  if (abs >= 1e12) return `${sign}${fmt(abs / 1e12)} T`
  if (abs >= 1e9) return `${sign}${fmt(abs / 1e9)} B`
  if (abs >= 1e6) return `${sign}${fmt(abs / 1e6)} M`
  if (abs >= 1e3) return `${sign}${fmt(abs / 1e3)} rb`
  return `${sign}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(abs)}`
}

interface OwnershipTabProps {
  ticker: string
  ownership: Ownership | null
}

export function OwnershipTab({ ticker, ownership }: OwnershipTabProps) {
  const t = useT()
  const hasNetwork = !!ownership?.network?.nodes?.length

  // Komposisi: sort desc by pct, drop yang null/0, ambil yang berarti (>=0.05%).
  const composition = useMemo(() => {
    const rows = (ownership?.composition ?? [])
      .filter((c) => (c.pct ?? 0) > 0)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    // Tampilin top yang signifikan; sisa kecil-kecil dilipat jadi "Lainnya".
    const SIGNIFICANT = 0.25
    const top = rows.filter((c) => (c.pct ?? 0) >= SIGNIFICANT)
    const tailPct = rows
      .filter((c) => (c.pct ?? 0) < SIGNIFICANT)
      .reduce((s, c) => s + (c.pct ?? 0), 0)
    return { top, tailPct }
  }, [ownership])

  const subsidiaries = useMemo(
    () =>
      (ownership?.subsidiaries ?? [])
        .filter((s) => s.name)
        .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)),
    [ownership],
  )

  // Daftar pemegang saham BERNAMA — diturunkan dari jaringan kepemilikan.
  // Node emiten ini = node company yg symbol-nya match ticker; fallback ke
  // node company yg paling banyak jadi tujuan edge (akar grafik). Pemegang =
  // edge.from dari semua edge yg `to`-nya node ini.
  const namedHolders = useMemo(() => {
    const nodes = ownership?.network?.nodes ?? []
    const edges = ownership?.network?.edges ?? []
    if (!nodes.length || !edges.length) return []

    const tickerU = ticker.toUpperCase()
    let self = nodes.find((n) => n.kind === 'company' && n.symbol?.toUpperCase() === tickerU)
    if (!self) {
      // Fallback: node company yg paling sering jadi `to` (akar kepemilikan).
      const inboundByCompany = new Map<string, number>()
      const companyById = new Map(nodes.filter((n) => n.kind === 'company').map((n) => [n.id, n]))
      for (const e of edges) {
        if (e.to && companyById.has(e.to)) {
          inboundByCompany.set(e.to, (inboundByCompany.get(e.to) ?? 0) + 1)
        }
      }
      let bestId: string | null = null
      let bestN = -1
      for (const [id, n] of inboundByCompany) {
        if (n > bestN) {
          bestN = n
          bestId = id
        }
      }
      self = bestId ? companyById.get(bestId) : undefined
    }
    if (!self) return []

    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    return edges
      .filter((e) => e.to === self!.id && e.from)
      .map((e) => ({
        node: nodeById.get(e.from as string),
        pct: e.pct ?? 0,
        shares: e.shares,
      }))
      .filter((h): h is { node: NonNullable<typeof h.node>; pct: number; shares: number | null } => !!h.node)
      .sort((a, b) => b.pct - a.pct)
  }, [ownership, ticker])

  // ── Empty state: emiten belum ke-scrape ──
  if (!ownership || !hasNetwork) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-2xl border p-8 sm:p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
          >
            <Network className="size-6" />
          </div>
          <h3 className="mt-4 text-lg font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            {t('ownership.emptyTitlePrefix')} {ticker} {t('ownership.emptyTitleSuffix')}
          </h3>
          <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-muted)' }}>
            {t('ownership.emptyDesc')}
          </p>
        </div>
      </div>
    )
  }

  const investorCount = ownership.network.nodes.filter((n) => n.kind === 'investor').length
  const companyCount = ownership.network.nodes.filter((n) => n.kind === 'company').length
  const activeId =
    ownership.network.nodes.find((n) => n.symbol?.toUpperCase() === ticker.toUpperCase())?.id ?? null

  return (
    <div className="space-y-5">
      {/* Header line */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow" style={{ color: 'var(--c-mint)' }}>{t('ownership.eyebrowNetwork')}</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            {t('ownership.asOf')} {formatTanggalID(ownership.asOf)} ·{' '}
            <span className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>{investorCount}</span> {t('ownership.investorsLabel')} ·{' '}
            <span className="num tabular font-semibold" style={{ color: 'var(--ink)' }}>{companyCount}</span> {t('ownership.companiesConnectedLabel')}
          </p>
        </div>
      </div>

      {/* Graf */}
      <div
        className="s-card overflow-hidden"
        style={{ padding: 0 }}
      >
        <OwnershipGraph network={ownership.network} activeId={activeId} />
      </div>

      <p className="text-[11px] flex items-start gap-1.5" style={{ color: 'var(--ink-soft)' }}>
        <Network className="size-3.5 shrink-0 mt-0.5" />
        {t('ownership.graphCaption')}
      </p>

      {/* Pemegang Saham (bernama) — diturunkan dari jaringan kepemilikan */}
      <div className="s-card p-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-4">
          <UserRound className="size-4 self-center" style={{ color: 'var(--c-mint)' }} />
          <p className="eyebrow" style={{ color: 'var(--c-mint)' }}>{t('ownership.shareholdersTitle')}</p>
          {namedHolders.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
              {t('ownership.fromNetwork')} {formatTanggalID(ownership.asOf)}
            </span>
          )}
          {namedHolders.length > 0 && (
            <span className="ml-auto text-xs num tabular" style={{ color: 'var(--ink-soft)' }}>
              {namedHolders.length} {t('ownership.holdersCountLabel')}
            </span>
          )}
        </div>

        {namedHolders.length > 0 ? (
          <div>
            {/* Header baris */}
            <div
              className="hidden sm:flex items-center gap-3 pb-2 mb-1 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: 'var(--ink-soft)', borderBottom: '1px solid var(--border-soft)' }}
            >
              <span className="flex-1">{t('ownership.colName')}</span>
              <span className="w-20 text-right">%</span>
              <span className="w-28 text-right">{t('ownership.colShares')}</span>
            </div>
            <div className="space-y-0.5">
              {namedHolders.map((h, i) => {
                const isCompany = h.node.kind === 'company'
                return (
                  <div
                    key={`${h.node.id}-${i}`}
                    className="flex items-center gap-3 py-2"
                    style={{ borderBottom: i < namedHolders.length - 1 ? '1px solid var(--border-soft)' : undefined }}
                  >
                    {/* Indikator jenis + nama */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isCompany && h.node.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.node.icon}
                          alt=""
                          className="size-5 rounded-full shrink-0 object-contain"
                          style={{ background: 'var(--surface-2)' }}
                        />
                      ) : (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: isCompany ? 'var(--c-mint)' : 'var(--ink-soft)' }}
                          title={isCompany ? t('ownership.kindCompany') : t('ownership.kindInvestor')}
                          aria-label={isCompany ? t('ownership.kindCompany') : t('ownership.kindInvestor')}
                        />
                      )}
                      <span
                        className="text-[13px] truncate"
                        style={{ color: 'var(--ink)' }}
                        title={h.node.name ?? ''}
                      >
                        {h.node.name ?? '—'}
                      </span>
                    </div>
                    {/* Persen */}
                    <span
                      className="num tabular text-[13px] font-bold shrink-0 w-20 text-right"
                      style={{ color: h.pct >= 50 ? 'var(--c-mint)' : 'var(--ink)' }}
                    >
                      {h.pct.toFixed(2)}%
                    </span>
                    {/* Lembar */}
                    <span
                      className="num tabular text-[12px] shrink-0 w-28 text-right"
                      style={{ color: 'var(--ink-muted)' }}
                      title={h.shares != null ? new Intl.NumberFormat('id-ID').format(h.shares) + ' ' + t('ownership.sharesUnit') : ''}
                    >
                      {formatShares(h.shares)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            {t('ownership.namedHoldersEmpty')}
          </p>
        )}
      </div>

      {/* Dua panel: komposisi + anak usaha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Komposisi pemegang saham */}
        <div className="s-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4" style={{ color: 'var(--c-mint)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {t('ownership.compositionTitle')}
            </p>
          </div>

          <div className="space-y-2.5">
            {composition.top.map((c, i) => {
              const pct = c.pct ?? 0
              return (
                <div key={`${c.label}-${i}`}>
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate" style={{ color: 'var(--ink)' }} title={c.label ?? ''}>
                      {c.label ?? '—'}
                    </span>
                    <span className="num tabular font-semibold shrink-0" style={{ color: 'var(--ink)' }}>
                      {pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="relative h-1.5 rounded-full mt-1" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${Math.min(100, pct)}%`, background: barColor(i, composition.top.length) }}
                    />
                  </div>
                </div>
              )
            })}

            {composition.tailPct > 0 && (
              <div className="flex items-center justify-between gap-2 text-[13px] pt-1">
                <span style={{ color: 'var(--ink-soft)' }}>{t('ownership.othersCombined')}</span>
                <span className="num tabular shrink-0" style={{ color: 'var(--ink-muted)' }}>
                  {composition.tailPct.toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          {ownership.totalShares != null && (
            <p className="text-[11px] mt-4 pt-3" style={{ color: 'var(--ink-soft)', borderTop: '1px solid var(--border-soft)' }}>
              {t('ownership.totalSharesOutstanding')}{' '}
              <span className="num tabular font-medium" style={{ color: 'var(--ink-muted)' }}>
                {formatIDRCompact(ownership.totalShares)}
              </span>{' '}
              {t('ownership.sharesUnit')}
            </p>
          )}
        </div>

        {/* Anak usaha */}
        <div className="s-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-4" style={{ color: 'var(--c-mint)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {t('ownership.subsidiariesTitle')}
            </p>
            <span className="ml-auto text-xs" style={{ color: 'var(--ink-soft)' }}>
              {subsidiaries.length}
            </span>
          </div>

          {subsidiaries.length > 0 ? (
            <div className="space-y-2 max-h-[420px] overflow-y-auto -mr-2 pr-2">
              {subsidiaries.map((s, i) => (
                <div
                  key={`${s.name}-${i}`}
                  className="flex items-center justify-between gap-3 py-1.5"
                  style={{ borderBottom: i < subsidiaries.length - 1 ? '1px solid var(--border-soft)' : undefined }}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] truncate" style={{ color: 'var(--ink)' }} title={s.name ?? ''}>
                      {s.name}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--ink-soft)' }} title={s.businessType ?? ''}>
                      {[s.location, s.businessType].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <span className="num tabular text-[13px] font-semibold shrink-0" style={{ color: (s.pct ?? 0) >= 50 ? 'var(--c-mint)' : 'var(--ink-muted)' }}>
                    {s.pct != null ? `${s.pct}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              {t('ownership.subsidiariesEmpty')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
