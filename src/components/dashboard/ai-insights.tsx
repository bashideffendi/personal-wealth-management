'use client'

/**
 * AI Insights card — Claude-generated personalized financial insights.
 *
 * Caches per period+user in localStorage with 24h TTL. User can
 * manually refresh via icon button. Renders 2-3 insight cards with
 * tone-coded styling.
 *
 * Cost: ~Rp 30 per refresh via Haiku 4.5. Cached daily = ~Rp 900/user/month.
 */

import { useEffect, useState, useMemo } from 'react'
import { Sparkles, RefreshCw, Loader2, AlertCircle, PenLine, Camera, Command as CommandIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import type { Transaction } from '@/types'

interface Insight {
  emoji: string
  title: string
  body: string
  tone: 'positive' | 'observation' | 'warning'
}

interface CachedInsights {
  period: string         // "2026-05" cache key
  data: Insight[]
  generated_at: string   // ISO
}

interface Props {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  selectedYear: number
  selectedMonth: number
  goals?: Array<{ name: string; target_amount: number; current_amount: number; deadline: string | null }>
}

const CACHE_KEY = 'pwm-ai-insights'
const CACHE_TTL_HOURS = 24

function getCache(periodKey: string): CachedInsights | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedInsights
    if (cached.period !== periodKey) return null
    const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / (1000 * 60 * 60)
    if (ageHours > CACHE_TTL_HOURS) return null
    return cached
  } catch {
    return null
  }
}

function setCache(cached: CachedInsights) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    /* ignore */
  }
}

const TONE_STYLES: Record<Insight['tone'], { bg: string; border: string; emoji_bg: string; tint: string }> = {
  positive:    { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.25)', emoji_bg: 'rgba(16, 185, 129, 0.15)', tint: 'var(--c-mint)' },
  observation: { bg: 'rgba(14, 165, 233, 0.06)', border: 'rgba(14, 165, 233, 0.25)', emoji_bg: 'rgba(14, 165, 233, 0.15)', tint: 'var(--sky-600)' },
  warning:     { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.30)', emoji_bg: 'rgba(245, 158, 11, 0.18)', tint: 'var(--amber-700)' },
}

export function AIInsightsCard({
  monthTransactions,
  yearTransactions,
  selectedYear,
  selectedMonth,
  goals,
}: Props) {
  const supabase = createClient()
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  // Build summary input from transactions
  const summaryInput = useMemo(() => {
    const income = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const saving = monthTransactions.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0)
    const investment = monthTransactions.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0)

    // Last month from yearTransactions
    const lastMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const lastYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const lmStart = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`
    const lmEndMonth = lastMonth === 12 ? 1 : lastMonth + 1
    const lmEndYear = lastMonth === 12 ? lastYear + 1 : lastYear
    const lmEnd = `${lmEndYear}-${String(lmEndMonth).padStart(2, '0')}-01`
    const lmTxs = yearTransactions.filter((t) => t.date >= lmStart && t.date < lmEnd)

    const last_month = {
      income: lmTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: lmTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      saving: lmTxs.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0),
      investment: lmTxs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    }

    // Expense by category (this month + last month)
    const catMap: Record<string, { this_month: number; last_month: number }> = {}
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense') continue
      if (!catMap[tx.category]) catMap[tx.category] = { this_month: 0, last_month: 0 }
      catMap[tx.category].this_month += tx.amount
    }
    for (const tx of lmTxs) {
      if (tx.type !== 'expense') continue
      if (!catMap[tx.category]) catMap[tx.category] = { this_month: 0, last_month: 0 }
      catMap[tx.category].last_month += tx.amount
    }
    const expense_by_category = Object.entries(catMap)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.this_month - a.this_month)
      .slice(0, 8)

    // Top 5 expense transactions this month
    const top_expenses = monthTransactions
      .filter((t) => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        description: t.description,
        category: t.category,
        amount: t.amount,
        date: t.date,
      }))

    return {
      period_label: `${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][selectedMonth - 1]} ${selectedYear}`,
      income, expense, saving, investment,
      net: income - expense - saving - investment,
      saving_rate: income > 0 ? ((saving + investment) / income) * 100 : 0,
      last_month,
      expense_by_category,
      top_expenses,
      goals: goals?.map((g) => ({
        name: g.name,
        progress_pct: g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0,
        remaining: Math.max(0, g.target_amount - g.current_amount),
        deadline: g.deadline ?? undefined,
      })),
      today: new Date().toISOString().split('T')[0],
    }
  }, [monthTransactions, yearTransactions, selectedYear, selectedMonth, goals])

  // Detect if there's enough data to call AI (current month OR last month)
  const hasAnyData = useMemo(() => {
    if (monthTransactions.length >= 1) return true
    // Check if last month has data (use yearTransactions to peek)
    const lastMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const lastYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const lmStart = `${lastYear}-${String(lastMonth).padStart(2, '0')}-01`
    const lmEndMonth = lastMonth === 12 ? 1 : lastMonth + 1
    const lmEndYear = lastMonth === 12 ? lastYear + 1 : lastYear
    const lmEnd = `${lmEndYear}-${String(lmEndMonth).padStart(2, '0')}-01`
    return yearTransactions.some((t) => t.date >= lmStart && t.date < lmEnd)
  }, [monthTransactions.length, yearTransactions, selectedYear, selectedMonth])

  // On mount + period change: try cache first, only fetch if stale or missing
  useEffect(() => {
    const cached = getCache(periodKey)
    if (cached) {
      setInsights(cached.data)
      setGeneratedAt(cached.generated_at)
      setError(null)
      return
    }
    // Only fetch if we have any data to analyze (current month OR last month)
    if (hasAnyData) {
      void fetchInsights()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, hasAnyData])

  async function fetchInsights() {
    // Check user is authed (cheap)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summaryInput),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal generate insights')
        setLoading(false)
        return
      }
      const data = json.data?.insights as Insight[] | undefined
      if (!data || !Array.isArray(data)) {
        setError('Response format tidak valid')
        setLoading(false)
        return
      }
      setInsights(data)
      const now = new Date().toISOString()
      setGeneratedAt(now)
      setCache({ period: periodKey, data, generated_at: now })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal fetch')
    } finally {
      setLoading(false)
      // Refresh badge — credits were either consumed (success) or refunded
      // (server-side on failure). Either way the displayed balance is stale.
      notifyAICreditsChanged()
    }
  }

  // Welcome card — shown when user has zero data anywhere yet (free + paid).
  // No API call wasted, but card still renders so paying users see the
  // feature exists and what to expect once they start logging.
  if (!hasAnyData && !insights) {
    return <WelcomeInsights />
  }

  return (
    <div
      className="kl-card p-5 sm:p-6 relative overflow-hidden"
      style={{ background: 'var(--c-violet-soft)' }}
    >
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* AI Insight card per design handoff InsightsBarA pattern —
              violet filled square (AI/langganan accent, per semantic rule) */}
          <div
            className="size-8 rounded-[10px] flex items-center justify-center"
            style={{ background: 'var(--c-violet)' }}
          >
            <Sparkles className="size-3.5 text-white" />
          </div>
          <div>
            <p className="kl-eyebrow" style={{ color: 'var(--c-violet)' }}>
              Insight Klunting AI
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              {generatedAt
                ? `Diperbarui ${formatRelative(generatedAt)} · cache 24 jam`
                : loading
                  ? 'Sedang menganalisis pola keuanganmu…'
                  : 'Klik refresh untuk generate insight'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchInsights}
          disabled={loading}
          className="rounded-md p-1.5 transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          aria-label="Refresh insights"
          title="Generate ulang (pakai 1 kredit AI)"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" style={{ color: 'var(--ink-muted)' }} />
          ) : (
            <RefreshCw className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
          )}
        </button>
      </div>

      <div className="relative">
      {error && (
        <div
          className="rounded-lg border p-3 flex items-start gap-2 text-xs"
          style={{ background: 'rgba(244,63,94,0.06)', borderColor: 'rgba(244,63,94,0.25)', color: 'var(--coral-700)' }}
        >
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && loading && !insights && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg animate-pulse"
              style={{ background: 'rgba(255,255,255,0.5)' }}
            />
          ))}
        </div>
      )}

      {/* Per dashboard-refine.jsx AI Insights pattern:
          - Main insight (first) gets the spotlight: medium-size text with
            highlighted emerald keywords
          - Secondary insights ("3 saran lainnya") shown as colored dot list */}
      {insights && insights.length > 0 && (() => {
        const main = insights[0]
        const rest = insights.slice(1, 4)  // up to 3 saran
        // Colored dots cycling through tone-coded palette per mockup
        const dotColors = ['var(--emerald-500)', 'var(--amber-500)', 'var(--sky-500)', 'var(--coral-500)']
        return (
          <>
            {/* MAIN insight — featured */}
            <p
              className="text-sm sm:text-[15px] leading-relaxed mb-1 font-medium"
              style={{ color: 'var(--ink)' }}
            >
              <span className="mr-1.5">{main.emoji}</span>
              {main.body}
            </p>

            {/* Secondary saran list with colored dot bullets */}
            {rest.length > 0 && (
              <div
                className="mt-4 pt-3 border-t"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                <p
                  className="text-[11px] font-semibold mb-2"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {rest.length} saran lainnya
                </p>
                <div className="space-y-1.5">
                  {rest.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--ink)' }}>
                      <span
                        className="size-1.5 rounded-full mt-2 shrink-0"
                        style={{ background: dotColors[i % dotColors.length] }}
                      />
                      <span className="leading-relaxed">{ins.title} — <span style={{ color: 'var(--ink-muted)' }}>{ins.body}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      })()}

      {insights && insights.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--ink-soft)' }}>
          Belum ada insight untuk periode ini. Coba lagi setelah ada lebih banyak transaksi.
        </p>
      )}
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

// ─── Welcome card for users with zero data ───────────────────────
// Static helpful tips. No API call. Disappears once user logs first transaction.

const WELCOME_TIPS: Array<{
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  title: string
  body: string
  href: string
  tone: Insight['tone']
}> = [
  {
    Icon: PenLine,
    title: 'Mulai dari Tambah Cepat',
    body: 'Buka /Transaksi → bar inline di atas tabel. Tab antar field, Enter simpan. 5 detik per transaksi.',
    href: '/dashboard/transactions',
    tone: 'observation',
  },
  {
    Icon: Camera,
    title: 'Foto struk → otomatis tercatat',
    body: 'Klik "Tambah Transaksi" → upload foto struk. AI ekstrak merchant, tanggal, total, kategori dalam 3 detik.',
    href: '/dashboard/transactions',
    tone: 'positive',
  },
  {
    Icon: CommandIcon,
    title: 'Tekan ⌘K dari mana aja',
    body: 'Quick add via natural language — ketik "indomaret 47rb cash", AI parse + langsung simpan ke akun default.',
    href: '/dashboard',
    tone: 'observation',
  },
]

function WelcomeInsights() {
  return (
    <div className="kl-card p-5" style={{ background: 'var(--c-violet-soft)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--c-violet)' }}
        >
          <Sparkles className="size-4 text-white" />
        </div>
        <div>
          <p className="kl-eyebrow" style={{ color: 'var(--c-violet)' }}>
            Insight AI personal
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-mute)' }}>
            Catat transaksi pertama, AI bakal kasih analisis pola pengeluaran dan saran konkret.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {WELCOME_TIPS.map((tip, i) => {
          const t = TONE_STYLES[tip.tone]
          const Icon = tip.Icon
          return (
            <a
              key={i}
              href={tip.href}
              className="rounded-lg border p-3 transition hover:scale-[1.02] hover:shadow-sm cursor-pointer"
              style={{ background: t.bg, borderColor: t.border }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="size-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: t.emoji_bg, color: t.tint }}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {tip.title}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                    {tip.body}
                  </p>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
