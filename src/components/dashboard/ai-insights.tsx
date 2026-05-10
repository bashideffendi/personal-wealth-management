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
import { Sparkles, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
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

const TONE_STYLES: Record<Insight['tone'], { bg: string; border: string; emoji_bg: string }> = {
  positive:    { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.25)', emoji_bg: 'rgba(16, 185, 129, 0.15)' },
  observation: { bg: 'rgba(14, 165, 233, 0.06)', border: 'rgba(14, 165, 233, 0.25)', emoji_bg: 'rgba(14, 165, 233, 0.15)' },
  warning:     { bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.30)', emoji_bg: 'rgba(245, 158, 11, 0.18)' },
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
      className="rounded-2xl border p-5 sm:p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, var(--surface), var(--emerald-50))',
        borderColor: 'var(--emerald-100)',
      }}
    >
      {/* Soft ambient glow per design handoff signature pattern */}
      <div
        className="absolute -top-16 -right-16 size-48 rounded-full opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--emerald-100), transparent 70%)' }}
      />
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {/* Per 03-component-patterns.md § AI Insight Card — emerald
              filled circle with sparkle, 28px size */}
          <div
            className="size-7 rounded-full flex items-center justify-center"
            style={{ background: 'var(--emerald-500)' }}
          >
            <Sparkles className="size-3.5 text-white" />
          </div>
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-semibold"
              style={{ color: 'var(--emerald-700)' }}
            >
              AI Insights
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

      {insights && insights.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins, i) => {
            const t = TONE_STYLES[ins.tone] ?? TONE_STYLES.observation
            return (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{ background: t.bg, borderColor: t.border }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="size-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ background: t.emoji_bg }}
                  >
                    {ins.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                      {ins.title}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                      {ins.body}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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

const WELCOME_TIPS: Array<{ emoji: string; title: string; body: string; href: string; tone: Insight['tone'] }> = [
  {
    emoji: '⚡',
    title: 'Mulai dari Tambah Cepat',
    body: 'Buka /Transaksi → bar inline di atas tabel. Tab antar field, Enter simpan. 5 detik per transaksi.',
    href: '/dashboard/transactions',
    tone: 'observation',
  },
  {
    emoji: '✨',
    title: 'Foto struk → otomatis tercatat',
    body: 'Klik "Tambah Transaksi" → upload foto struk. Claude AI ekstrak merchant, tanggal, total, kategori dalam 3 detik.',
    href: '/dashboard/transactions',
    tone: 'positive',
  },
  {
    emoji: '⌘',
    title: 'Tekan ⌘K dari mana aja',
    body: 'Quick add via natural language — ketik "indomaret 47rb cash", AI parse + langsung simpan ke akun default.',
    href: '/dashboard',
    tone: 'observation',
  },
]

function WelcomeInsights() {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04), rgba(14, 165, 233, 0.04))',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--emerald-500), var(--sky-500))' }}
        >
          <Sparkles className="size-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Insight AI Personal — Siap Buat Kamu 🎉
          </p>
          <p className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
            Mulai catat transaksi pertamamu, AI bakal kasih analisis pola pengeluaran dan saran konkret.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {WELCOME_TIPS.map((tip, i) => {
          const t = TONE_STYLES[tip.tone]
          return (
            <a
              key={i}
              href={tip.href}
              className="rounded-lg border p-3 transition hover:scale-[1.02] hover:shadow-sm cursor-pointer"
              style={{ background: t.bg, borderColor: t.border }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="size-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: t.emoji_bg }}
                >
                  {tip.emoji}
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
