'use client'

import Link from 'next/link'
import { ChevronRight, Sparkles } from 'lucide-react'
import { PLAYBOOKS } from '@/lib/playbooks'
import { playbookIcon } from '@/components/playbook/icons'
import { useT } from '@/lib/i18n/context'

export default function PlaybookIndexPage() {
  const t = useT()
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="size-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)' }}
          >
            <Sparkles className="size-4" />
          </div>
          <span className="eyebrow" style={{ color: 'var(--c-primary)' }}>
            Playbook
          </span>
        </div>
        <h1 className="t-h1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
          {t('playbook.title')}
        </h1>
        <p className="t-body mt-1.5 max-w-2xl" style={{ color: 'var(--ink-soft)' }}>
          {t('playbook.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {PLAYBOOKS.map((p) => {
          const Icon = playbookIcon(p.iconKey)
          return (
            <Link
              key={p.slug}
              href={`/dashboard/playbook/${p.slug}`}
              className="s-card p-5 group transition hover:shadow-md flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="size-11 rounded-xl flex items-center justify-center"
                  style={{ background: `color-mix(in oklab, ${p.accent} 14%, transparent)`, color: p.accent }}
                >
                  <Icon className="size-5" />
                </div>
                <ChevronRight
                  className="size-4 mt-1 transition group-hover:translate-x-0.5"
                  style={{ color: 'var(--text-mute)' }}
                />
              </div>
              <h2 className="t-title font-semibold" style={{ color: 'var(--ink)' }}>
                {p.title}
              </h2>
              <p className="t-sm mt-1 flex-1" style={{ color: 'var(--ink-soft)' }}>
                {p.tagline}
              </p>
              <p className="t-cap mt-3" style={{ color: 'var(--text-mute)' }}>
                {p.steps.length} {t('playbook.steps_suffix')}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
