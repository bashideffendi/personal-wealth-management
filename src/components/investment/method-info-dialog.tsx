'use client'

import { useState } from 'react'
import { AlertCircle, BookOpen, Check, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  METHOD_INFO,
  getAvoidReason,
  getSuitability,
  suitabilityLabel,
  type Suitability,
} from '@/lib/invest/valuation-methods'

const ALL_SECTORS = [
  'Financials',
  'Energy',
  'Basic Materials',
  'Industrials',
  'Consumer Cyclicals',
  'Consumer Non-Cyclicals',
  'Healthcare',
  'Technology',
  'Infrastructures',
  'Properties & Real Estate',
  'Transportation & Logistic',
  'Utilities',
]

/** Light-theme badge palette per suitability. */
function suitStyle(s: Suitability): { bg: string; fg: string } {
  if (s === 'ideal') return { bg: 'var(--c-mint)', fg: '#FFFFFF' }
  if (s === 'avoid') return { bg: 'var(--c-coral)', fg: '#FFFFFF' }
  return { bg: 'var(--surface-2)', fg: 'var(--ink-muted)' }
}

/**
 * Tombol buku per baris yang buka dialog penjelasan metode lengkap
 * (asal-usul, rumus, cara kerja, kapan cocok, batasan, kesesuaian sektor).
 */
export function MethodInfoDialog({
  methodKey,
  sector,
}: {
  methodKey: string
  sector?: string | null
}) {
  const [open, setOpen] = useState(false)
  const info = METHOD_INFO[methodKey]
  if (!info) return null

  const suitability = sector ? getSuitability(methodKey, sector) : null
  const avoidReason = sector ? getAvoidReason(methodKey, sector) : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={`Info ${info.label}`}
        style={{ color: 'var(--ink-soft)' }}
      >
        <BookOpen className="size-3.5" />
      </Button>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-[620px]"
        style={{ background: 'var(--surface)' }}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle style={{ color: 'var(--ink)' }}>{info.label}</DialogTitle>
              <DialogDescription className="mt-1" style={{ color: 'var(--ink-muted)' }}>
                {info.tagline}
              </DialogDescription>
            </div>
            {suitability && (
              <span
                className="inline-flex items-center shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: suitStyle(suitability).bg, color: suitStyle(suitability).fg }}
              >
                {suitabilityLabel(suitability)}
                {sector && <span className="ml-1 opacity-80">· {sector}</span>}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {avoidReason && (
            <div
              className="flex items-start gap-2 rounded-md p-3 text-sm"
              style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)' }}
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-coral)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--coral-600)' }}>
                  Kurang cocok buat sektor {sector}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>{avoidReason}</p>
              </div>
            </div>
          )}

          <Section label="Pengembang">
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{info.origin}</p>
          </Section>

          <Section label="Rumus">
            <pre
              className="num overflow-x-auto rounded-md p-3 text-xs"
              style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
            >
              {info.formula}
            </pre>
          </Section>

          <Section label="Cara kerjanya">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              {info.howItWorks}
            </p>
          </Section>

          <Section label="Kapan paling bekerja">
            <ul className="flex flex-col gap-1 text-sm">
              {info.bestFor.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-mint)' }} />
                  <span style={{ color: 'var(--ink)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Batasan">
            <ul className="flex flex-col gap-1 text-sm">
              {info.limitations.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <X className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--c-coral)' }} />
                  <span style={{ color: 'var(--ink-muted)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Data yang dibutuhkan">
            <div className="flex flex-wrap gap-1.5">
              {info.requires.map((r) => (
                <Badge key={r} variant="outline" className="font-normal">
                  {r}
                </Badge>
              ))}
            </div>
          </Section>

          <Section label="Kesesuaian per sektor (IDX)">
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
              {ALL_SECTORS.map((sec) => {
                const s = getSuitability(methodKey, sec)
                const st = suitStyle(s)
                return (
                  <span
                    key={sec}
                    className="inline-flex items-center justify-start rounded-full px-2 py-0.5 text-[11px] font-normal"
                    style={{ background: st.bg, color: st.fg }}
                  >
                    <span className="truncate">{sec}</span>
                  </span>
                )
              })}
            </div>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="eyebrow">{label}</h4>
      {children}
    </div>
  )
}
