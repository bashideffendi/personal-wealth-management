'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronRight, Sparkles, X, Loader2 } from 'lucide-react'

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
      title: 'Buat akun pertama',
      desc: 'Tambah akun bank, dompet digital, atau cash buat mulai mencatat.',
      cta: 'Tambah Akun',
      href: '/dashboard/accounts',
      done: state.hasAccount,
    },
    {
      key: 'hasTransaction',
      title: 'Catat transaksi pertama',
      desc: 'Coba scan struk dengan AI atau input manual — yang mana lebih cepat.',
      cta: 'Catat Transaksi',
      href: '/dashboard/transactions',
      done: state.hasTransaction,
    },
    {
      key: 'hasBudget',
      title: 'Atur anggaran bulanan',
      desc: 'Set limit per kategori biar pengeluaran ga lepas kontrol.',
      cta: 'Buat Anggaran',
      href: '/dashboard/budgeting',
      done: state.hasBudget,
    },
  ]

  return (
    <div className="rounded-2xl border-2 border-dashed border-burgundy-300 bg-gradient-to-br from-burgundy-50 to-amber-50 p-5 sm:p-6"
      style={{
        borderColor: 'rgba(139, 21, 56, 0.25)',
        background: 'linear-gradient(135deg, rgba(139, 21, 56, 0.04), rgba(217, 119, 6, 0.04))',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <Sparkles className="size-4" style={{ color: 'var(--burgundy-700, #8b1538)' }} />
          </div>
          <div>
            <h3 className="font-semibold text-base">Selangkah Lagi</h3>
            <p className="text-xs text-muted-foreground">
              {completedCount} dari 3 langkah selesai · {Math.round(progressPct)}%
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={dismissing}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          {dismissing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          Sembunyikan
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, var(--burgundy-600, #9d1f4a), var(--burgundy-400, #d04976))',
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 transition ${
              step.done ? 'opacity-60' : ''
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                step.done
                  ? 'bg-[var(--c-mint-soft)]0 border-emerald-500 text-white'
                  : 'border-muted-foreground/30 bg-white text-muted-foreground'
              }`}
            >
              {step.done ? <Check className="size-4" /> : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                {step.title}
              </p>
              {!step.done && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              )}
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: 'var(--burgundy-700, #8b1538)' }}
              >
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
