'use client'

import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { PLAYBOOKS } from '@/lib/playbooks'
import { playbookIcon } from '@/components/playbook/icons'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useT } from '@/lib/i18n/context'

export default function PlaybookIndexPage() {
  const t = useT()
  return (
    <div className="space-y-6">
      <QuietPageHeader
        title={t('playbook.title')}
        info={t('playbook.subtitle')}
        icon={Sparkles}
      />

      {/* Baris-compact: 1 kartu + hairline divider (pola galeri kalkulator) */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        {PLAYBOOKS.map((p, i) => {
          const Icon = playbookIcon(p.iconKey)
          return (
            <Link
              key={p.slug}
              href={`/dashboard/playbook/${p.slug}`}
              className="group flex items-center gap-3 px-3.5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
              style={{ minHeight: 60, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
            >
              <div
                className="size-[30px] rounded-lg grid place-items-center shrink-0"
                style={{ background: `color-mix(in oklab, ${p.accent} 14%, transparent)`, color: p.accent }}
              >
                <Icon className="size-[15px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium truncate leading-tight" style={{ color: 'var(--ink)' }}>
                  {p.title}
                </p>
                <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                  {p.tagline} · {p.steps.length} {t('playbook.steps_suffix')}
                </p>
              </div>
              <ChevronRight
                className="size-4 shrink-0 transition group-hover:translate-x-0.5"
                style={{ color: 'var(--text-mute)' }}
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
