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
import { useT, useI18n } from '@/lib/i18n/context'
import { monthShort, relativeTime } from '@/lib/i18n/dates'
import { rootCategory } from '@/lib/budget-categories'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import type { Transaction } from '@/types'

interface Insight {
  emoji: string
  title: string
  body: string
  tone: 'positive' | 'observation' | 'warning'
}

interface CachedInsights {
  data: Insight[]
  generated_at: string   // ISO
}
type CacheStore = Record<string, CachedInsights>

interface Props {
  monthTransactions: Transaction[]
  yearTransactions: Transaction[]
  selectedYear: number
  selectedMonth: number
  goals?: Array<{ name: string; target_amount: number; current_amount: number; deadline: string | null }>
}

const CACHE_KEY = 'pwm-ai-insights'
const CACHE_TTL_HOURS = 24

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Bentuk lama = satu entri { period, data, generated_at } → migrasikan.
    if (parsed && parsed.period) return { [parsed.period]: { data: parsed.data, generated_at: parsed.generated_at } }
    return parsed && typeof parsed === 'object' ? (parsed as CacheStore) : {}
  } catch {
    return {}
  }
}

// Cache PER PERIODE — dulu single-entry: pindah bulan di period picker
// menimpa cache, balik lagi = fetch ulang = bakar kredit tiap switch.
function getCache(periodKey: string): CachedInsights | null {
  if (typeof window === 'undefined') return null
  const entry = readStore()[periodKey]
  if (!entry) return null
  const ageHours = (Date.now() - new Date(entry.generated_at).getTime()) / 3_600_000
  return ageHours > CACHE_TTL_HOURS ? null : entry
}

function setCache(periodKey: string, entry: CachedInsights) {
  if (typeof window === 'undefined') return
  try {
    const store = readStore()
    store[periodKey] = entry
    const keys = Object.keys(store).sort()
    while (keys.length > 6) delete store[keys.shift() as string]
    localStorage.setItem(CACHE_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

const TONE_STYLES: Record<Insight['tone'], { bg: string; border: string; emoji_bg: string; tint: string }> = {
  positive:    { bg: 'color-mix(in srgb, var(--c-mint) 6%, transparent)', border: 'color-mix(in srgb, var(--c-mint) 25%, transparent)', emoji_bg: 'color-mix(in srgb, var(--c-mint) 15%, transparent)', tint: 'var(--c-mint-ink)' },
  observation: { bg: 'color-mix(in srgb, var(--c-violet) 6%, transparent)', border: 'color-mix(in srgb, var(--c-violet) 25%, transparent)', emoji_bg: 'color-mix(in srgb, var(--c-violet) 15%, transparent)', tint: 'var(--c-violet-ink)' },
  warning:     { bg: 'color-mix(in srgb, var(--c-amber) 6%, transparent)', border: 'color-mix(in srgb, var(--c-amber) 30%, transparent)', emoji_bg: 'color-mix(in srgb, var(--c-amber) 18%, transparent)', tint: 'var(--c-amber-ink)' },
}

export function AIInsightsCard({
  monthTransactions,
  yearTransactions,
  selectedYear,
  selectedMonth,
  goals,
}: Props) {
  const t = useT()
  const { locale } = useI18n()
  const supabase = createClient()
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  // Build summary input from transactions
  const summaryInput = useMemo(() => {
    // Transfer antar-akun (2 leg income+expense) WAJIB di-exclude — kalau ikut,
    // ringkasan yang dianalisis AI dobel dan insight-nya menyesatkan.
    const income = monthTransactions.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
    const expense = monthTransactions.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0)
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
      income: lmTxs.filter((t) => t.type === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0),
      expense: lmTxs.filter((t) => t.type === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0),
      saving: lmTxs.filter((t) => t.type === 'saving').reduce((s, t) => s + t.amount, 0),
      investment: lmTxs.filter((t) => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    }

    // Expense by category (this month + last month)
    const catMap: Record<string, { this_month: number; last_month: number }> = {}
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense' || tx.category === 'Transfer') continue
      const c = rootCategory(tx.category) // gabung subkategori ke induknya
      if (!catMap[c]) catMap[c] = { this_month: 0, last_month: 0 }
      catMap[c].this_month += tx.amount
    }
    for (const tx of lmTxs) {
      if (tx.type !== 'expense' || tx.category === 'Transfer') continue
      const c = rootCategory(tx.category)
      if (!catMap[c]) catMap[c] = { this_month: 0, last_month: 0 }
      catMap[c].last_month += tx.amount
    }
    const expense_by_category = Object.entries(catMap)
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.this_month - a.this_month)
      .slice(0, 8)

    // Top 5 expense transactions this month
    const top_expenses = monthTransactions
      .filter((t) => t.type === 'expense' && t.category !== 'Transfer')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((t) => ({
        description: t.description,
        category: t.category,
        amount: t.amount,
        date: t.date,
      }))

    return {
      period_label: `${monthShort(selectedMonth - 1, locale)} ${selectedYear}`,
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
  }, [monthTransactions, yearTransactions, selectedYear, selectedMonth, goals, locale])

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
        setError(json.error ?? t('ai_insights.error_generate'))
        setLoading(false)
        return
      }
      const data = json.data?.insights as Insight[] | undefined
      if (!data || !Array.isArray(data)) {
        setError(t('ai_insights.error_format'))
        setLoading(false)
        return
      }
      setInsights(data)
      const now = new Date().toISOString()
      setGeneratedAt(now)
      setCache(periodKey, { data, generated_at: now })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai_insights.error_fetch'))
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
      className="s-card p-5 sm:p-6 relative overflow-hidden"
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
            <p className="eyebrow" style={{ color: 'var(--c-violet-ink)' }}>
              {t('ai_insights.title')}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
              {generatedAt
                ? `${t('ai_insights.updated_prefix')} ${relativeTime(generatedAt, locale)} ${t('ai_insights.cache_suffix')}`
                : loading
                  ? t('ai_insights.analyzing')
                  : t('ai_insights.click_refresh')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchInsights}
          disabled={loading}
          className="rounded-md p-1.5 transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          aria-label="Refresh insights"
          title={t('ai_insights.refresh_title')}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" style={{ color: 'var(--ink-muted)' }} />
          ) : (
            <RefreshCw className="size-3.5" style={{ color: 'var(--ink-muted)' }} />
          )}
        </button>
      </div>

      <div className="relative">
      {error && (() => {
        // "Kredit AI habis" bukan error beneran — cuma kehabisan kredit. Pakai
        // gaya amber/info yg lembut + Sparkles, bukan merah-alarm yg bikin panik.
        const isInfo = /kredit/i.test(error)
        return (
          <div
            className="rounded-lg border p-3 flex items-start gap-2 text-xs"
            style={isInfo
              ? { background: 'var(--c-amber-soft)', borderColor: 'color-mix(in srgb, var(--c-amber) 28%, transparent)', color: 'var(--c-amber-ink)' }
              : { background: 'color-mix(in srgb, var(--c-coral) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--c-coral) 25%, transparent)', color: 'var(--c-coral-ink)' }}
          >
            {isInfo ? <Sparkles className="size-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="size-3.5 mt-0.5 shrink-0" />}
            <span>{error}</span>
          </div>
        )
      })()}

      {/* Empty/error state (mis. kredit habis) — kasih pointer ke fitur lain biar
          kartu tetap berguna & gak kosong nunggu AI. */}
      {error && !insights && !loading && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: t('ai_insights.ptr_budget'), desc: t('ai_insights.ptr_budget_desc'), href: '/dashboard/budgeting' },
            { label: t('ai_insights.ptr_tx'), desc: t('ai_insights.ptr_tx_desc'), href: '/dashboard/transactions' },
            { label: t('ai_insights.ptr_nw'), desc: t('ai_insights.ptr_nw_desc'), href: '/dashboard/net-worth' },
          ].map((p) => (
            <a
              key={p.href}
              href={p.href}
              className="rounded-lg border p-3 transition hover:shadow-sm"
              style={{ borderColor: 'var(--border-soft)', background: 'color-mix(in srgb, var(--surface) 55%, transparent)' }}
            >
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>{p.label}</p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-muted)' }}>{p.desc}</p>
            </a>
          ))}
        </div>
      )}

      {!error && loading && !insights && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg animate-pulse"
              style={{ background: 'color-mix(in srgb, var(--surface) 50%, transparent)' }}
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
        const dotColors = ['var(--c-mint)', 'var(--c-amber)', 'var(--c-violet)', 'var(--c-coral)']
        return (
          <>
            {/* MAIN insight — featured */}
            {/* Emoji dari AI sengaja TIDAK dirender — aturan anti-slop app. */}
            <p
              className="text-sm sm:text-[15px] leading-relaxed mb-1 font-medium"
              style={{ color: 'var(--ink)' }}
            >
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
                  {rest.length} {t('ai_insights.other_suggestions')}
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
          {t('ai_insights.empty_state')}
        </p>
      )}
      </div>
    </div>
  )
}

// ─── Welcome card for users with zero data ───────────────────────
// Static helpful tips. No API call. Disappears once user logs first transaction.

const WELCOME_TIPS: Array<{
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  titleKey: string
  bodyKey: string
  href: string
  tone: Insight['tone']
}> = [
  {
    Icon: PenLine,
    titleKey: 'ai_insights.welcome_tip1_title',
    bodyKey: 'ai_insights.welcome_tip1_body',
    href: '/dashboard/transactions',
    tone: 'observation',
  },
  {
    Icon: Camera,
    titleKey: 'ai_insights.welcome_tip2_title',
    bodyKey: 'ai_insights.welcome_tip2_body',
    href: '/dashboard/transactions',
    tone: 'positive',
  },
  {
    Icon: CommandIcon,
    titleKey: 'ai_insights.welcome_tip3_title',
    bodyKey: 'ai_insights.welcome_tip3_body',
    href: '/dashboard',
    tone: 'observation',
  },
]

function WelcomeInsights() {
  const t = useT()
  return (
    <div className="s-card p-5" style={{ background: 'var(--c-violet-soft)' }}>
      <div className="flex items-center gap-2 mb-4">
        <div
          className="size-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--c-violet)' }}
        >
          <Sparkles className="size-4 text-white" />
        </div>
        <div>
          <p className="eyebrow" style={{ color: 'var(--c-violet)' }}>
            {t('ai_insights.welcome_eyebrow')}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-mute)' }}>
            {t('ai_insights.welcome_desc')}
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {WELCOME_TIPS.map((tip, i) => {
          const toneStyle = TONE_STYLES[tip.tone]
          const Icon = tip.Icon
          return (
            <a
              key={i}
              href={tip.href}
              className="rounded-lg border p-3 transition hover:scale-[1.02] hover:shadow-sm cursor-pointer"
              style={{ background: toneStyle.bg, borderColor: toneStyle.border }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="size-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: toneStyle.emoji_bg, color: toneStyle.tint }}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {t(tip.titleKey)}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                    {t(tip.bodyKey)}
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
