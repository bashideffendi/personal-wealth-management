'use client'

/**
 * Command Palette (Cmd+K / Ctrl+K)
 *
 * Linear-style: grouped results, icons, recent items, smart quick actions.
 * Open via global keyboard shortcut or by clicking the Search button in header.
 *
 * Phase 1.3.A — UI enhancement (this file).
 * Phase 1.3.B (TODO) — Natural-language transaction parsing via Claude Haiku.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { formatRupiahPlain } from '@/lib/utils'
import { NAV_ITEMS, type NavItem } from '@/lib/constants'
import {
  Search, ArrowRight, Sparkles, Receipt, Wallet, Target, Calculator,
  Plus, FileText, History, CornerDownLeft, ChevronUp, ChevronDown,
  Loader2, Check, AlertCircle, Mic, MicOff, Folder, CreditCard,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { useT } from '@/lib/i18n/context'

const RECENT_KEY = 'pwm-recent-pages'
const RECENT_LIMIT = 3

type ItemKind = 'page' | 'action' | 'recent' | 'ai'

interface PaletteItem {
  id: string
  label: string
  href?: string         // navigation target
  onSelect?: () => void // override action
  breadcrumb?: string   // section path (e.g. "Kekayaan")
  kind: ItemKind
  icon?: React.ReactNode
}

// ─── Flatten NAV_ITEMS into searchable list ──────────────────────

function flatten(items: NavItem[], trail: string[] = []): PaletteItem[] {
  const out: PaletteItem[] = []
  for (const it of items) {
    out.push({
      id: `nav:${it.href}`,
      label: it.label,
      href: it.href,
      breadcrumb: trail.join(' › '),
      kind: 'page',
    })
    if (it.children) out.push(...flatten(it.children, [...trail, it.label]))
  }
  return out
}

// ─── Recent pages (localStorage) ─────────────────────────────────

function getRecent(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function pushRecent(href: string) {
  if (typeof window === 'undefined') return
  try {
    const list = getRecent().filter((h) => h !== href)
    list.unshift(href)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)))
  } catch {
    /* ignore */
  }
}

// ─── Quick actions ───────────────────────────────────────────────

function buildQuickActions(t: (path: string) => string): PaletteItem[] {
  return [
    { id: 'a:add-tx',       label: t('command_palette.action_add_tx'),       href: '/dashboard/transactions',  kind: 'action', icon: <Plus className="size-4" /> },
    { id: 'a:add-account',  label: t('command_palette.action_add_account'),  href: '/dashboard/accounts',      kind: 'action', icon: <Wallet className="size-4" /> },
    { id: 'a:add-goal',     label: t('command_palette.action_add_goal'),     href: '/dashboard/goals',         kind: 'action', icon: <Target className="size-4" /> },
    { id: 'a:set-budget',   label: t('command_palette.action_set_budget'),   href: '/dashboard/budgeting',     kind: 'action', icon: <FileText className="size-4" /> },
    { id: 'a:scan-receipt', label: t('command_palette.action_scan_receipt'), href: '/dashboard/transactions',  kind: 'action', icon: <Sparkles className="size-4" /> },
    { id: 'a:report',       label: t('command_palette.action_report'),       href: '/dashboard/monthly-report', kind: 'action', icon: <Receipt className="size-4" /> },
    { id: 'a:calc',         label: t('command_palette.action_calc'),         href: '/dashboard/calculators',   kind: 'action', icon: <Calculator className="size-4" /> },
    { id: 'a:playbook',     label: t('command_palette.action_playbook'),     href: '/dashboard/playbook',      kind: 'action', icon: <Sparkles className="size-4" /> },
  ]
}

// ─── Component ───────────────────────────────────────────────────

interface ParsedTransaction {
  type: 'income' | 'expense' | 'saving' | 'investment'
  amount: number
  category: string
  description: string
  payment_hint?: string
  confidence: 'high' | 'medium' | 'low'
}

type AIState =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'preview'; data: ParsedTransaction }
  | { kind: 'saving' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
  const [aiState, setAiState] = useState<AIState>({ kind: 'idle' })
  const [isMac, setIsMac] = useState(false)
  useEffect(() => { setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) }, [])
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const t = useT()

  const allPages = useMemo(() => flatten(NAV_ITEMS), [])
  const quickActions = useMemo(() => buildQuickActions(t), [t])

  // ─── Voice input (Web Speech API, id-ID) ──────────────────────
  // Live partial transcripts update the input. When recognition ends,
  // if the result looks like a transaction (has digits, > 4 chars),
  // auto-trigger AI parse so the user doesn't have to press Enter.
  const speech = useSpeechRecognition({
    onResult: (transcript) => setQuery(transcript),
    onEnd: (finalTranscript) => {
      const t = finalTranscript.trim()
      if (t && /\d/.test(t) && t.length > 4) {
        parseAndPreview(t)
      }
    },
  })

  // Refresh recent list whenever palette opens (in case user navigated)
  useEffect(() => {
    if (open) setRecentHrefs(getRecent())
  }, [open])

  // Make sure the mic stops if the palette closes mid-listen
  useEffect(() => {
    if (!open && speech.listening) speech.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Track current page into recent on path change
  useEffect(() => {
    if (pathname.startsWith('/dashboard')) pushRecent(pathname)
  }, [pathname])

  // ─── Filter logic ─────────────────────────────────────────────
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      (item.breadcrumb?.toLowerCase().includes(q) ?? false)

    // Recent (only when no query) — resolve href to page object
    const recent = !q
      ? recentHrefs
          .map((href) => allPages.find((p) => p.href === href))
          .filter((p): p is PaletteItem => !!p)
          .slice(0, RECENT_LIMIT)
          .map((p) => ({ ...p, id: `r:${p.href}`, kind: 'recent' as const, icon: <History className="size-4" /> }))
      : []

    const pages = allPages.filter(matches).slice(0, 8)
    const actions = quickActions.filter(matches)

    // AI quick-add detection — if query has digits, treat as potential transaction
    const aiItems: PaletteItem[] = []
    if (q && /\d/.test(q) && q.length > 4) {
      aiItems.push({
        id: 'ai:quick-add',
        label: `${t('command_palette.ai_quick_add')}: "${query.trim()}"`,
        breadcrumb: t('command_palette.ai_quick_add_hint'),
        kind: 'ai',
        icon: <Sparkles className="size-4" />,
        onSelect: () => parseAndPreview(query.trim()),
      })
    }

    return [
      { key: 'recent', label: t('command_palette.group_recent'), items: recent },
      { key: 'ai', label: t('command_palette.group_ai'), items: aiItems },
      { key: 'pages', label: t('command_palette.group_pages'), items: pages },
      { key: 'actions', label: t('command_palette.group_actions'), items: actions },
    ].filter((g) => g.items.length > 0)
  }, [query, allPages, quickActions, recentHrefs, router, t])

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  // ─── Keyboard handlers ────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Explicit-open event — used by QuickAddLauncher's "Ketik dengan AI" hand-off.
  // A dedicated open (not a ⌘K toggle) so an already-open palette is never
  // accidentally closed during the hand-off.
  useEffect(() => {
    function onOpenEvent() {
      setOpen(true)
    }
    window.addEventListener('klunting:open-command-palette', onOpenEvent)
    return () =>
      window.removeEventListener('klunting:open-command-palette', onOpenEvent)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIdx(0)
      setAiState({ kind: 'idle' })
    }
  }, [open])

  function go(item: PaletteItem) {
    if (item.onSelect) {
      item.onSelect()
      // Don't close — let action handle closing
      return
    }
    if (item.href) router.push(item.href)
    setOpen(false)
  }

  async function parseAndPreview(text: string) {
    setAiState({ kind: 'parsing' })
    try {
      const res = await fetch('/api/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAiState({ kind: 'error', message: json.error ?? t('command_palette.parse_failed') })
        return
      }
      setAiState({ kind: 'preview', data: json.data as ParsedTransaction })
    } catch (err) {
      setAiState({
        kind: 'error',
        message: err instanceof Error ? err.message : t('command_palette.parse_failed'),
      })
    } finally {
      // Refresh badge — credits consumed (success) or refunded (server-side failure)
      notifyAICreditsChanged()
    }
  }

  async function saveTransaction(data: ParsedTransaction) {
    setAiState({ kind: 'saving' })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setAiState({ kind: 'error', message: t('command_palette.error_not_logged_in') })
      return
    }

    // Find a default account — try profile.default_account_id first, else cash, else first
    const profRes = await supabase
      .from('profiles')
      .select('default_account_id')
      .eq('id', user.id)
      .maybeSingle()
    const accRes = await supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)

    const accounts = (accRes.data ?? []) as { id: string; name: string; type: string }[]
    if (accounts.length === 0) {
      setAiState({
        kind: 'error',
        message: t('command_palette.error_no_account'),
      })
      return
    }

    const defaultId = (profRes.data as { default_account_id: string } | null)?.default_account_id
    const accountId =
      accounts.find((a) => a.id === defaultId)?.id ??
      accounts.find((a) => a.type === 'cash')?.id ??
      accounts[0].id

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      account_id: accountId,
      type: data.type,
      category: data.category,
      description: data.description,
      amount: data.amount,
    })

    if (error) {
      setAiState({ kind: 'error', message: error.message })
      return
    }
    setAiState({ kind: 'success' })
    setTimeout(() => {
      setOpen(false)
      setAiState({ kind: 'idle' })
      router.refresh()
    }, 1200)
  }

  function resetAI() {
    setAiState({ kind: 'idle' })
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatItems[selectedIdx]
      if (item) go(item)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden border shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          {speech.listening ? (
            <div className="relative size-4 shrink-0 flex items-center justify-center">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'var(--c-coral)', opacity: 0.4 }}
              />
              <span
                className="relative size-2 rounded-full"
                style={{ background: 'var(--c-coral)' }}
              />
            </div>
          ) : (
            <Search className="size-4 shrink-0" style={{ color: 'var(--ink-soft)' }} />
          )}

          <input
            autoFocus
            value={speech.listening && speech.interim ? `${query} ${speech.interim}`.trim() : query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={
              speech.listening
                ? t('command_palette.listening_placeholder')
                : t('command_palette.search_placeholder')
            }
            className="flex-1 bg-transparent outline-none text-[15px]"
            style={{ color: 'var(--ink)' }}
            readOnly={speech.listening}
          />

          {speech.supported && (
            <button
              type="button"
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              className="shrink-0 size-7 rounded-md flex items-center justify-center transition"
              style={{
                background: speech.listening
                  ? 'var(--c-coral)'
                  : 'var(--surface-2)',
                color: speech.listening ? '#FFFFFF' : 'var(--ink-muted)',
              }}
              aria-label={speech.listening ? t('command_palette.mic_stop_label') : t('command_palette.mic_start_label')}
              title={speech.listening ? t('command_palette.mic_stop_title') : t('command_palette.mic_start_title')}
            >
              {speech.listening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </button>
          )}

          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
          >
            ESC
          </kbd>
        </div>

        {/* AI overlay states — shown when user triggered NL parse */}
        {aiState.kind !== 'idle' && (
          <AIPanel
            state={aiState}
            text={query}
            onConfirm={(d) => saveTransaction(d)}
            onCancel={resetAI}
          />
        )}

        {/* Results — only when AI is idle */}
        {aiState.kind === 'idle' && (
        <div className="max-h-[60vh] overflow-y-auto py-2 sidebar-nav-scroll">
          {flatItems.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <Search
                className="size-8 mx-auto mb-3 opacity-30"
                style={{ color: 'var(--ink-soft)' }}
              />
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                {t('command_palette.empty_not_found')} &ldquo;{query}&rdquo;.
              </p>
              <p className="text-xs mt-3" style={{ color: 'var(--ink-soft)' }}>
                {t('command_palette.empty_try_one')}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {['indomaret 47rb cash', 'gaji 8jt', 'transaksi', 'budget bulan ini', 'net worth'].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setQuery(ex)}
                    className="text-[11px] px-2 py-1 rounded-md font-medium transition"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            (() => {
              let renderIdx = 0
              return groups.map((group) => (
                <div key={group.key} className="mb-1">
                  <p
                    className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.12em] font-semibold"
                    style={{ color: 'var(--ink-soft)' }}
                  >
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const idx = renderIdx++
                    const isSelected = idx === selectedIdx
                    const isAI = item.kind === 'ai'
                    return (
                      <button
                        key={item.id}
                        onClick={() => go(item)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors group"
                        style={{
                          background: isSelected
                            ? isAI
                              ? 'rgba(139, 92, 246, 0.10)'
                              : 'var(--c-mint-soft)'
                            : 'transparent',
                        }}
                      >
                        <span
                          className="flex size-8 items-center justify-center rounded-lg shrink-0"
                          style={{
                            background: isSelected
                              ? isAI
                                ? 'rgba(139, 92, 246, 0.20)'
                                : 'var(--c-mint-soft)'
                              : 'var(--surface-2)',
                            color: isSelected
                              ? isAI
                                ? 'var(--c-violet)'
                                : 'var(--c-mint)'
                              : 'var(--ink-muted)',
                          }}
                        >
                          {item.icon ?? <ArrowRight className="size-4" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className="block text-sm font-medium truncate"
                            style={{ color: 'var(--ink)' }}
                          >
                            {item.label}
                          </span>
                          {item.breadcrumb && (
                            <span
                              className="block text-[11px] truncate"
                              style={{ color: 'var(--ink-soft)' }}
                            >
                              {item.breadcrumb}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <CornerDownLeft
                            className="size-3.5 shrink-0"
                            style={{ color: 'var(--ink-soft)' }}
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            })()
          )}
        </div>
        )}

        {/* Footer hints */}
        <div
          className="flex items-center justify-between px-4 py-2.5 text-[10px] border-t"
          style={{ borderColor: 'var(--border-soft)', color: 'var(--ink-soft)' }}
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>
                <ChevronUp className="size-2.5" />
              </Kbd>
              <Kbd>
                <ChevronDown className="size-2.5" />
              </Kbd>
              <span className="ml-1">{t('command_palette.hint_navigate')}</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="size-2.5" />
              </Kbd>
              <span>{t('command_palette.hint_select')}</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd>
              <span>{t('command_palette.hint_close')}</span>
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="font-mono px-1.5 py-0.5 rounded text-[9px] inline-flex items-center"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
    >
      {children}
    </kbd>
  )
}

// ─── AI Panel — shown when user triggers natural-language parse ──

interface AIPanelProps {
  state: Exclude<AIState, { kind: 'idle' }>
  text: string
  onConfirm: (data: ParsedTransaction) => void
  onCancel: () => void
}

function AIPanel({ state, text, onConfirm, onCancel }: AIPanelProps) {
  const t = useT()
  if (state.kind === 'parsing') {
    return (
      <div className="px-6 py-12 text-center">
        <Loader2 className="size-6 mx-auto animate-spin" style={{ color: 'var(--c-mint-ink)' }} />
        <p className="text-sm mt-3 font-medium" style={{ color: 'var(--ink)' }}>
          {t('command_palette.ai_parsing')}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
          &ldquo;{text}&rdquo;
        </p>
      </div>
    )
  }

  if (state.kind === 'preview') {
    const d = state.data
    const typeLabel: Record<string, string> = {
      expense: t('command_palette.type_expense'),
      income: t('command_palette.type_income'),
      saving: t('command_palette.type_saving'),
      investment: t('command_palette.type_investment'),
    }
    const typeColor: Record<string, string> = {
      expense: 'var(--c-coral)', income: 'var(--c-mint)', saving: 'var(--c-amber)', investment: 'var(--sky-500)',
    }
    const fmt = formatRupiahPlain(d.amount)
    return (
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-3.5" style={{ color: 'var(--c-mint-ink)' }} />
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--c-mint-ink)' }}>
            {t('command_palette.ai_confirm_title')}
          </p>
        </div>
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: typeColor[d.type] + '20', color: typeColor[d.type] }}
            >
              {typeLabel[d.type] ?? d.type}
            </span>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {t('command_palette.accuracy_label')} <strong style={{ color: 'var(--ink)' }}>{d.confidence === 'high' ? t('command_palette.confidence_high') : d.confidence === 'medium' ? t('command_palette.confidence_medium') : t('command_palette.confidence_low')}</strong>
            </p>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {fmt}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>
            {d.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
            <span className="inline-flex items-center gap-1"><Folder className="size-3 shrink-0" /> {d.category}</span>
            {d.payment_hint && <span className="inline-flex items-center gap-1"><CreditCard className="size-3 shrink-0" /> {d.payment_hint}</span>}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-md transition hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--ink-muted)' }}
          >
            ← {t('command_palette.back')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(d)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
            style={{
              background: 'var(--c-primary)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <Check className="size-4" />
            {t('command_palette.save_to_default')}
          </button>
        </div>
        <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--ink-soft)' }}>
          {t('command_palette.save_footnote')}
        </p>
      </div>
    )
  }

  if (state.kind === 'saving') {
    return (
      <div className="px-6 py-12 text-center">
        <Loader2 className="size-6 mx-auto animate-spin" style={{ color: 'var(--c-mint-ink)' }} />
        <p className="text-sm mt-3 font-medium" style={{ color: 'var(--ink)' }}>{t('command_palette.saving')}</p>
      </div>
    )
  }

  if (state.kind === 'success') {
    return (
      <div className="px-6 py-12 text-center">
        <div
          className="size-12 mx-auto rounded-full flex items-center justify-center"
          style={{ background: 'var(--c-mint-soft)' }}
        >
          <Check className="size-6" style={{ color: 'var(--c-mint-ink)' }} />
        </div>
        <p className="text-sm mt-3 font-semibold" style={{ color: 'var(--ink)' }}>
          {t('command_palette.recorded')}
        </p>
      </div>
    )
  }

  // error
  return (
    <div className="px-6 py-8 text-center">
      <div
        className="size-10 mx-auto rounded-full flex items-center justify-center"
        style={{ background: 'rgba(244,63,94,0.12)' }}
      >
        <AlertCircle className="size-5" style={{ color: 'var(--c-coral-ink)' }} />
      </div>
      <p className="text-sm mt-3 font-medium" style={{ color: 'var(--ink)' }}>
        {t('command_palette.parse_failed')}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{state.message}</p>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs mt-4 px-3 py-1.5 rounded-md transition hover:bg-[var(--surface-2)]"
        style={{ color: 'var(--ink-muted)' }}
      >
        ← {t('command_palette.back')}
      </button>
    </div>
  )
}
