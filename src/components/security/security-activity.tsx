'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { relativeTime } from '@/lib/i18n/dates'
import { History, LogIn, KeyRound, ShieldCheck, ShieldOff, Loader2, type LucideIcon } from 'lucide-react'
import type { SecurityEventRow } from '@/lib/security-events'

const ICON: Record<string, LucideIcon> = {
  login: LogIn,
  password_changed: KeyRound,
  mfa_enabled: ShieldCheck,
  mfa_disabled: ShieldOff,
}

export function SecurityActivity() {
  const { t, locale } = useI18n()
  const [rows, setRows] = useState<SecurityEventRow[] | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('security_events')
          .select('id, event, created_at')
          .order('created_at', { ascending: false })
          .limit(10)
        if (active) setRows((data as SecurityEventRow[]) ?? [])
      } catch {
        if (active) setRows([])
      }
    })()
    return () => { active = false }
  }, [])

  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">{t('security_events.title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('security_events.desc')}</p>
        </div>
      </div>

      {rows === null ? (
        <Loader2 className="size-4 animate-spin" style={{ color: 'var(--ink-soft)' }} />
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{t('security_events.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const Icon = ICON[r.event] ?? History
            return (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="size-8 rounded-lg grid place-items-center shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}>
                  <Icon className="size-4" />
                </span>
                <span className="flex-1" style={{ color: 'var(--ink)' }}>{t(`security_events.evt_${r.event}`)}</span>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>{relativeTime(r.created_at, locale)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
