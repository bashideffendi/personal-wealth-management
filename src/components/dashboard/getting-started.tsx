'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronRight, Sparkles, X, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/context'

interface MissionState {
  hasAccount: boolean
  hasTransaction: boolean
  hasBudget: boolean
}

/**
 * "Selangkah Lagi" — onboarding progress card.
 *
 * Shows the user a curated next-steps checklist after signup. Auto-hides
 * once all 3 milestones are reached, OR if user dismisses (stored in
 * profiles.onboarding_completed).
 *
 * Differentiator vs competitors: skippable (advanced users don't get
 * pushed through it), and progress is contextual (re-appears if user
 * resets data).
 */
export function GettingStarted() {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [state, setState] = useState<MissionState>({
    hasAccount: false,
    hasTransaction: false,
    hasBudget: false,
  })
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [profRes, accRes, txRes, budRes] = await Promise.all([
      supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle(),
      supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('budgets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    if (profRes.data && (profRes.data as { onboarding_completed: boolean }).onboarding_completed) {
      setHidden(true)
    }
    setState({
      hasAccount: (accRes.count ?? 0) > 0,
      hasTransaction: (txRes.count ?? 0) > 0,
      hasBudget: (budRes.count ?? 0) > 0,
    })
    setLoading(false)
  }

  async function dismiss() {
    setDismissing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDismissing(false); return }
    await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
    setDismissing(false)
    setHidden(true)
  }

  if (loading || hidden) return null

  const completedCount = (state.hasAccount ? 1 : 0) + (state.hasTransaction ? 1 : 0) + (state.hasBudget ? 1 : 0)

  // If user already finished everything, auto-mark and hide
  if (completedCount === 3) {
    void (async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', u.id)
    })()
    return null
  }

  const progressPct = (completedCount / 3) * 100

  const steps: Array<{
    key: keyof MissionState
    title: string
    desc: string
    cta: string
    href: string
    done: boolean
  }> = [
    {
      key: 'hasAccount',
      title: t('getting_started.step_account_title'),
      desc: t('getting_started.step_account_desc'),
      cta: t('getting_started.step_account_cta'),
      href: '/dashboard/accounts',
      done: state.hasAccount,
    },
    {
      key: 'hasTransaction',
      title: t('getting_started.step_transaction_title'),
      desc: t('getting_started.step_transaction_desc'),
      cta: t('getting_started.step_transaction_cta'),
      href: '/dashboard/transactions',
      done: state.hasTransaction,
    },
    {
      key: 'hasBudget',
      title: t('getting_started.step_budget_title'),
      desc: t('getting_started.step_budget_desc'),
      cta: t('getting_started.step_budget_cta'),
      href: '/dashboard/budgeting',
      done: state.hasBudget,
    },
  ]

  return (
    <div
      className="s-card p-5 sm:p-6"
      style={{ background: 'var(--c-primary-soft)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="size-8 rounded-[10px] flex items-center justify-center"
            style={{ background: 'var(--c-primary)' }}
          >
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <p className="eyebrow" style={{ color: 'var(--c-primary-ink)' }}>
              {t('getting_started.eyebrow')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-mute)' }}>
              {completedCount} {t('getting_started.steps_progress')} ·{' '}
              <span className="num tabular font-semibold">{Math.round(progressPct)}%</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={dismissing}
          className="text-xs inline-flex items-center gap-1 transition"
          style={{ color: 'var(--text-mute)' }}
        >
          {dismissing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          {t('getting_started.dismiss')}
        </button>
      </div>

      {/* Progress bar */}
      <div className="kl-bar mb-4" style={{ color: 'var(--c-primary-ink)' }}>
        <i style={{ width: `${progressPct}%` }} />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
              step.done ? 'opacity-60' : ''
            }`}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
            }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: step.done ? 'var(--c-mint)' : 'transparent',
                border: step.done ? 'none' : '2px solid var(--line-strong)',
                color: '#FFFFFF',
              }}
            >
              {step.done ? <Check className="size-4" /> : null}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium"
                style={{
                  color: step.done ? 'var(--text-mute)' : 'var(--ink)',
                  textDecoration: step.done ? 'line-through' : undefined,
                }}
              >
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-mute)' }}>
                  {step.desc}
                </p>
              )}
            </div>
            {!step.done && (
              <Link href={step.href} className="btn-outline btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                {step.cta}
                <ChevronRight className="size-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
