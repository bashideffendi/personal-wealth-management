'use client'

/**
 * AI Credits Badge — small chip in the header showing current AI credit
 * balance with a tooltip explaining what it's for + a link to upgrade
 * when the balance is getting low.
 *
 * Pulls fresh status from the ai_credit_status SQL function on mount and
 * after each potential AI call (component listens to a custom event
 * dispatched by other components after AI calls so the badge can update
 * without a page reload).
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Zap, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CreditStatus {
  current: number
  cap: number
  renewalAt: string | null
}

export function AICreditsBadge() {
  const supabase = createClient()
  const [status, setStatus] = useState<CreditStatus | null>(null)
  const [open, setOpen] = useState(false)

  const fetchStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    type Row = { current_credits: number; monthly_cap: number; renewal_at: string }
    const { data } = await supabase.rpc('ai_credit_status', { p_user_id: user.id })
    const row = (data as Row[] | null)?.[0]
    if (row) {
      setStatus({
        current: row.current_credits ?? 0,
        cap: row.monthly_cap ?? 10,
        renewalAt: row.renewal_at ?? null,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void fetchStatus()
    // Listen for AI call events so badge refreshes after consuming
    const handler = () => { void fetchStatus() }
    window.addEventListener('pwm:ai-credits-changed', handler)
    return () => window.removeEventListener('pwm:ai-credits-changed', handler)
  }, [fetchStatus])

  if (!status) return null

  const pct = status.cap > 0 ? (status.current / status.cap) * 100 : 0
  const low = pct < 20
  const empty = status.current === 0
  // Use the shared formatDate so renewal date renders the same way as
  // every other date in the app (e.g. "10 Juni 2026"). Previously this
  // used a one-off short format which drifted from the rest of the UI.
  const renewalText = status.renewalAt ? formatDate(status.renewalAt) : '—'

  return (
    <div className="relative">
      {/* Per dashboard-refine.jsx mockup line 83 — emerald pill style:
          "⚡ {n} AI credits". Cleaner than the previous "current/cap" format
          which read as "90/10" and confused users. Cap detail still
          available in the dropdown panel below. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors hover:opacity-90"
        style={{
          background: empty ? 'rgba(239,68,68,0.10)' : low ? 'rgba(245,158,11,0.12)' : 'var(--c-mint-soft)',
          color: empty ? 'var(--c-coral)' : low ? 'var(--amber-700)' : 'var(--emerald-800)',
        }}
        title="Kredit AI — buat scan struk, AI parse, & insight"
        aria-label="AI credit balance"
      >
        <Zap className="size-3 fill-current" />
        <span className="num tabular">{status.current}</span>
        <span>AI credits</span>
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-lg border shadow-xl p-3 z-50"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: '0 10px 30px -8px rgba(0,0,0,0.18)',
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                  Kredit AI Tersisa
                </p>
                {/* Just the current balance — no /cap inline (read as "86/10"
                    which confused users when accumulated balance exceeds the
                    monthly cap). Cap shown separately in the explainer below. */}
                <p className="num tabular text-3xl font-bold mt-0.5" style={{ color: 'var(--ink)' }}>
                  {status.current}
                </p>
              </div>
              <Zap className="size-5 fill-current" style={{ color: low ? '#F59E0B' : '#10B981' }} />
            </div>

            {/* Progress bar — current vs cap, capped at 100% visual */}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  background: empty
                    ? '#EF4444'
                    : low
                      ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                      : 'linear-gradient(90deg, #10B981, #6366F1)',
                }}
              />
            </div>

            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              Plafon bulanan{' '}
              <span className="num font-semibold" style={{ color: 'var(--ink)' }}>{status.cap}</span>
              {' '}kredit · top-up otomatis{' '}
              <span style={{ color: 'var(--ink)' }}>{renewalText}</span>
            </p>

            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
              <p className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>
                Biaya per fitur
              </p>
              <ul className="space-y-1 text-[11px]" style={{ color: 'var(--ink)' }}>
                <li className="flex justify-between">
                  <span>Scan struk</span><span className="num tabular font-medium">5</span>
                </li>
                <li className="flex justify-between">
                  <span>AI Insight</span><span className="num tabular font-medium">2</span>
                </li>
                <li className="flex justify-between">
                  <span>Quick add (text/voice)</span><span className="num tabular font-medium">1</span>
                </li>
              </ul>
            </div>

            {(low || empty) && (
              <Link
                href="/dashboard/pricing"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFFFF',
                }}
              >
                <span>Upgrade ke Pro/Family</span>
                <ChevronRight className="size-3.5" />
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Helper: dispatch the credits-changed event so the badge refreshes.
 * Call this from any client component right after a successful AI call.
 */
export function notifyAICreditsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pwm:ai-credits-changed'))
  }
}
