'use client'

/**
 * QuickAddLauncher — FAB + bottom-sheet untuk tambah transaksi cepat.
 *
 * Tap "+" → sheet 3 pilihan:
 *   1. Foto struk      → buka kamera (capture=environment), AI parse, preview, save
 *   2. Ketik dengan AI → dispatch ⌘K, biar CommandPalette handle (NL parse)
 *   3. Form manual     → inline dialog form
 *
 * Konsisten desktop + mobile. Mobile sebelumnya cuma buka Cmd+K — gak ngasih
 * akses ke kamera dari FAB. Sekarang foto struk adalah opsi pertama.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useCategoryOptions } from '@/lib/use-category-options'
import type { Account, CreditCard } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Camera,
  MessageSquareText,
  PenLine,
  Loader2,
  Check,
  ChevronLeft,
  Sparkles,
} from 'lucide-react'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'

type TxType = 'income' | 'expense' | 'saving' | 'investment'
type Mode = 'menu' | 'scanning' | 'preview' | 'manual'

interface ManualFormState {
  date: string
  account_id: string
  type: TxType
  category: string
  description: string
  amount: number
}

interface ReceiptData {
  merchant: string
  date: string
  total: number
  type: TxType
  category: string
  description: string
  payment_method?: string
  payment_detail?: string
  confidence: 'high' | 'medium' | 'low'
}

const TYPE_TINT: Record<TxType, string> = {
  income: 'var(--c-mint)',
  expense: 'var(--c-coral)',
  saving: 'var(--amber-500)',
  investment: 'var(--sky-500)',
}

interface QuickAddLauncherProps {
  /**
   * 'desktop' = floating FAB di kanan-bawah (hidden di mobile, bottom-tab handles)
   * 'mobile'  = sheet hanya, button-nya rendered dari bottom-tab-bar
   */
  variant?: 'desktop' | 'mobile'
}

export function QuickAddLauncher({ variant = 'desktop' }: QuickAddLauncherProps) {
  const t = useT()
  const router = useRouter()
  const supabase = createClient()
  const { firstOf } = useCategoryOptions()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')

  // Receipt flow state
  const [previewData, setPreviewData] = useState<ReceiptData | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [savingReceipt, setSavingReceipt] = useState(false)

  // Manual form state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [form, setForm] = useState<ManualFormState>({
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    type: 'expense',
    category: firstOf('expense'),
    description: '',
    amount: 0,
  })
  const [manualSaving, setManualSaving] = useState(false)

  // Cache of recent transactions for smart category suggestion. Loaded once
  // when the sheet opens — no per-keystroke Supabase round-trip.
  const [recentTx, setRecentTx] = useState<Array<{ description: string; category: string; type: TxType }>>([])

  // Listen for global event so mobile bottom-tab-bar can trigger us
  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('klunting:quick-add', onOpen)
    return () => window.removeEventListener('klunting:quick-add', onOpen)
  }, [])

  // PWA shortcut handler — manifest has /dashboard?quickadd=1 wired to the
  // "Tambah Transaksi" home-screen shortcut. When the user long-presses the
  // icon and picks the shortcut, we open the sheet and strip the param so
  // refresh doesn't keep re-opening it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('quickadd') === '1') {
      setOpen(true)
      sp.delete('quickadd')
      const newQs = sp.toString()
      const newUrl = window.location.pathname + (newQs ? `?${newQs}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Load accounts when sheet opens (for both receipt save & manual form)
  useEffect(() => {
    if (!open) return
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const [a, c, t] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase
          .from('credit_cards')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true),
        // Last 100 transactions — used for smart category suggestion via
        // in-memory substring match against `description`.
        supabase
          .from('transactions')
          .select('description, category, type')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(100),
      ])
      setAccounts((a.data ?? []) as Account[])
      setCards((c.data ?? []) as CreditCard[])
      setRecentTx(
        ((t.data ?? []) as Array<{ description: string | null; category: string; type: TxType }>)
          .filter((r) => !!r.description)
          .map((r) => ({ description: r.description as string, category: r.category, type: r.type })),
      )
    })()
  }, [open, supabase])

  // Reset state on close
  useEffect(() => {
    if (open) return
    // small delay so user doesn't see flash during close animation
    const t = setTimeout(() => {
      setMode('menu')
      setPreviewData(null)
      setScanError(null)
      setForm({
        date: new Date().toISOString().split('T')[0],
        account_id: '',
        type: 'expense',
        category: firstOf('expense'),
        description: '',
        amount: 0,
      })
    }, 200)
    return () => clearTimeout(t)
  }, [open])

  // ─── Foto struk handlers ────────────────────────────────────────

  function pickFile() {
    setScanError(null)
    fileRef.current?.click()
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setScanError(t('quickadd.err_not_image'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanError(t('quickadd.err_too_large'))
      return
    }
    setMode('scanning')
    setScanError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/extract-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        setScanError(json.error ?? `${t('quickadd.failed_prefix')} ${res.status}`)
        setMode('menu')
        return
      }
      const data = json.data as ReceiptData
      setPreviewData(data)
      setMode('preview')
    } catch (err) {
      setScanError(err instanceof Error ? err.message : t('quickadd.scan_failed'))
      setMode('menu')
    } finally {
      notifyAICreditsChanged()
    }
  }

  // Pick default account: profile default → cash → first
  async function pickDefaultAccount(): Promise<{ id: string } | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const profRes = await supabase
      .from('profiles')
      .select('default_account_id')
      .eq('id', user.id)
      .maybeSingle()
    const allAccounts = accounts
    if (allAccounts.length === 0) return null
    const defaultId = (profRes.data as { default_account_id: string } | null)?.default_account_id
    const acc =
      allAccounts.find((a) => a.id === defaultId) ??
      allAccounts.find((a) => a.type === 'cash') ??
      allAccounts[0]
    return { id: acc.id }
  }

  async function saveReceipt() {
    if (!previewData) return
    setSavingReceipt(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSavingReceipt(false)
      toast.error(t('quickadd.not_logged_in'))
      return
    }
    const acc = await pickDefaultAccount()
    if (!acc) {
      setSavingReceipt(false)
      toast.error(t('quickadd.no_account_title'), {
        description: t('quickadd.no_account_desc'),
      })
      return
    }
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      date: previewData.date,
      account_id: acc.id,
      type: previewData.type,
      category: previewData.category,
      description: previewData.description || previewData.merchant,
      amount: previewData.total,
    })
    setSavingReceipt(false)
    if (error) {
      toast.error(t('quickadd.save_failed'), { description: error.message })
      return
    }
    toast.success(t('quickadd.saved'), {
      description: `${previewData.merchant} · Rp ${previewData.total.toLocaleString('id-ID')}`,
    })
    setOpen(false)
    router.refresh()
  }

  // ─── Manual form handlers ──────────────────────────────────────

  function setType(t: TxType) {
    setForm((prev) => ({
      ...prev,
      type: t,
      category: firstOf(t),
    }))
  }

  async function saveManual() {
    if (!form.account_id) {
      toast.error(t('quickadd.pick_account_first'))
      return
    }
    if (!form.amount || form.amount <= 0) {
      toast.error(t('quickadd.amount_gt_zero'))
      return
    }
    setManualSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setManualSaving(false)
      return
    }
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      date: form.date,
      account_id: form.account_id,
      type: form.type,
      category: form.category,
      description: form.description,
      amount: form.amount,
    })

    // Bump credit card outstanding if applicable
    const cc = cards.find((c) => c.id === form.account_id)
    if (cc && form.type === 'expense' && !error) {
      await supabase
        .from('credit_cards')
        .update({ current_balance: cc.current_balance + form.amount })
        .eq('id', cc.id)
    }

    setManualSaving(false)
    if (error) {
      toast.error(t('quickadd.save_failed'), { description: error.message })
      return
    }
    toast.success(t('quickadd.saved'))
    setOpen(false)
    router.refresh()
  }

  function openCommandPalette() {
    setOpen(false)
    // Wait until the sheet's close animation fully finishes before opening the
    // palette. Opening it mid-close made the two overlays' focus traps fight —
    // the sheet got stuck open behind the palette. Use an explicit open event
    // (not a ⌘K toggle) so an already-open palette is never accidentally closed.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('klunting:open-command-palette'))
    }, 320)
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <>
      {/* Hidden file input — wired to receipt picker, capture=environment so
          mobile opens camera. Lives at root so it survives mode transitions. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ''
        }}
      />

      {variant === 'desktop' && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg flex items-center justify-center z-30 transition-all hover:scale-110 active:scale-95"
          style={{
            background: 'var(--c-primary)',
            color: 'var(--c-primary-foreground)',
            boxShadow: '0 10px 24px -6px rgba(16, 24, 40, 0.14)',
          }}
          aria-label={t('quickadd.add_transaction')}
          title={t('quickadd.add_transaction')}
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          {mode === 'menu' && (
            <MenuView
              onPickReceipt={pickFile}
              onPickAI={openCommandPalette}
              onPickManual={() => setMode('manual')}
              scanError={scanError}
            />
          )}
          {mode === 'scanning' && <ScanningView />}
          {mode === 'preview' && previewData && (
            <PreviewView
              data={previewData}
              accounts={accounts}
              saving={savingReceipt}
              onBack={() => {
                setPreviewData(null)
                setMode('menu')
              }}
              onSave={saveReceipt}
            />
          )}
          {mode === 'manual' && (
            <ManualForm
              form={form}
              setForm={setForm}
              setType={setType}
              accounts={accounts}
              cards={cards}
              recentTx={recentTx}
              saving={manualSaving}
              onBack={() => setMode('menu')}
              onSave={saveManual}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Subviews ──────────────────────────────────────────────────────

function MenuView({
  onPickReceipt,
  onPickAI,
  onPickManual,
  scanError,
}: {
  onPickReceipt: () => void
  onPickAI: () => void
  onPickManual: () => void
  scanError: string | null
}) {
  const t = useT()
  const items = [
    {
      key: 'receipt',
      icon: Camera,
      title: t('quickadd.receipt_title'),
      body: t('quickadd.receipt_body'),
      tint: 'var(--c-mint)',
      bg: 'var(--c-mint-soft)',
      onSelect: onPickReceipt,
    },
    {
      key: 'ai',
      icon: MessageSquareText,
      title: t('quickadd.ai_title'),
      body: t('quickadd.ai_body'),
      tint: 'var(--c-violet)',
      bg: 'rgba(139,92,246,0.12)',
      onSelect: onPickAI,
    },
    {
      key: 'manual',
      icon: PenLine,
      title: t('quickadd.manual_title'),
      body: t('quickadd.manual_body'),
      tint: 'var(--ink-muted)',
      bg: 'var(--surface-2)',
      onSelect: onPickManual,
    },
  ] as const

  return (
    <>
      <DialogHeader className="px-5 pt-5">
        <DialogTitle>{t('quickadd.add_transaction')}</DialogTitle>
        <DialogDescription>{t('quickadd.menu_subtitle')}</DialogDescription>
      </DialogHeader>

      <div className="px-3 pb-3 pt-2">
        {scanError && (
          <div
            className="mx-2 mb-2 rounded-lg border p-2.5 text-xs"
            style={{
              background: 'var(--danger-bg)',
              borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
              color: 'var(--danger)',
            }}
          >
            {scanError}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {items.map((it) => {
            const Icon = it.icon
            return (
              <button
                key={it.key}
                type="button"
                onClick={it.onSelect}
                className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-[var(--surface-2)] active:scale-[0.99]"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: it.bg, color: it.tint }}
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block text-sm font-semibold"
                    style={{ color: 'var(--ink)' }}
                  >
                    {it.title}
                  </span>
                  <span
                    className="block text-xs"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {it.body}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

function ScanningView() {
  const t = useT()
  return (
    <div className="px-6 py-12 text-center">
      <div className="relative mx-auto size-12 flex items-center justify-center">
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'var(--c-mint)', opacity: 0.15 }}
        />
        <Loader2
          className="size-8 animate-spin relative"
          style={{ color: 'var(--c-mint)' }}
        />
      </div>
      <p className="mt-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {t('quickadd.scanning_title')}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
        {t('quickadd.scanning_body')}
      </p>
    </div>
  )
}

function PreviewView({
  data,
  accounts,
  saving,
  onBack,
  onSave,
}: {
  data: ReceiptData
  accounts: Account[]
  saving: boolean
  onBack: () => void
  onSave: () => void
}) {
  const t = useT()
  const typeLabel: Record<TxType, string> = {
    income: t('quickadd.type_income'),
    expense: t('quickadd.type_expense'),
    saving: t('quickadd.type_saving'),
    investment: t('quickadd.type_investment'),
  }
  const confidenceLabel =
    data.confidence === 'high'
      ? t('quickadd.confidence_high')
      : data.confidence === 'medium'
        ? t('quickadd.confidence_medium')
        : t('quickadd.confidence_low')

  return (
    <>
      <div
        className="flex items-center justify-between px-5 pt-5 pb-3"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color: 'var(--ink-muted)' }}
        >
          <ChevronLeft className="size-4" />
          {t('quickadd.back')}
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
          style={{
            background: 'var(--c-mint-soft)',
            color: 'var(--c-mint)',
            letterSpacing: '0.06em',
          }}
        >
          <Sparkles className="size-3" />
          {t('quickadd.accuracy')} {confidenceLabel}
        </span>
      </div>

      <div className="px-5 pb-3">
        <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ink-soft)' }}>
          {data.merchant}
        </p>
        <p
          className="num tabular text-3xl font-bold mt-1"
          style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
        >
          Rp {data.total.toLocaleString('id-ID')}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className="inline-flex items-center px-2 py-1 rounded-full font-semibold uppercase"
            style={{
              background: 'color-mix(in srgb, ' + TYPE_TINT[data.type] + ' 12%, transparent)',
              color: TYPE_TINT[data.type],
              letterSpacing: '0.04em',
            }}
          >
            {typeLabel[data.type]}
          </span>
          <span
            className="inline-flex items-center px-2 py-1 rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)' }}
          >
            {data.category}
          </span>
          <span style={{ color: 'var(--ink-muted)' }}>
            {new Date(data.date).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>

        {data.description && (
          <p className="mt-3 text-sm" style={{ color: 'var(--ink-muted)' }}>
            {data.description}
          </p>
        )}

        <div
          className="mt-4 rounded-lg border p-3 text-xs"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border-soft)',
            color: 'var(--ink-muted)',
          }}
        >
          {accounts.length === 0 ? (
            <span style={{ color: 'var(--danger)' }}>
              {t('quickadd.no_account_notice')}
            </span>
          ) : (
            <>
              {t('quickadd.default_account_notice')}
            </>
          )}
        </div>
      </div>

      <DialogFooter className="px-5 pb-5">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={saving}
          className="sm:flex-none flex-1"
        >
          {t('quickadd.edit_first')}
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || accounts.length === 0}
          className="sm:flex-none flex-1"
          style={{
            background: 'var(--c-primary)',
            color: 'var(--c-primary-foreground)',
            boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
          }}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('quickadd.saving')}
            </>
          ) : (
            <>
              <Check className="size-4" />
              {t('quickadd.save')}
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Smart category suggestion based on prior similar transactions.
 *
 * Match by simple substring on description (case-insensitive), filtered to
 * the same type (expense/income/etc). Among matches, the most-used category
 * wins. Returns null if no useful signal — caller hides the chip.
 *
 * Why so simple? Users tend to write the same description-ish for the same
 * spending pattern ("indomaret", "starbucks", "shopee"). One substring hit
 * is enough signal; we don't need NLP.
 */
function suggestCategory(
  description: string,
  recentTx: Array<{ description: string; category: string; type: TxType }>,
  currentType: TxType,
  currentCategory: string,
): string | null {
  const q = description.trim().toLowerCase()
  if (q.length < 3) return null
  const matches = recentTx.filter(
    (t) => t.type === currentType && t.description.toLowerCase().includes(q),
  )
  if (matches.length === 0) return null
  const counts = new Map<string, number>()
  for (const m of matches) counts.set(m.category, (counts.get(m.category) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted[0]
  // Don't suggest the same category the user already picked
  if (!top || top[0] === currentCategory) return null
  return top[0]
}

function ManualForm({
  form,
  setForm,
  setType,
  accounts,
  cards,
  recentTx,
  saving,
  onBack,
  onSave,
}: {
  form: ManualFormState
  setForm: React.Dispatch<React.SetStateAction<ManualFormState>>
  setType: (t: TxType) => void
  accounts: Account[]
  cards: CreditCard[]
  recentTx: Array<{ description: string; category: string; type: TxType }>
  saving: boolean
  onBack: () => void
  onSave: () => void
}) {
  const t = useT()
  const { optionsForType } = useCategoryOptions()
  const suggested = suggestCategory(form.description, recentTx, form.type, form.category)
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium hover:underline"
          style={{ color: 'var(--ink-muted)' }}
        >
          <ChevronLeft className="size-4" />
          {t('quickadd.back')}
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('quickadd.manual_title')}
        </p>
        <span className="w-12" />
      </div>

      <div className="grid gap-3 px-5 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>{t('quickadd.type')}</Label>
            <Select
              value={form.type}
              onValueChange={(v) => v && setType(v as TxType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t('quickadd.type_expense')}</SelectItem>
                <SelectItem value="income">{t('quickadd.type_income')}</SelectItem>
                <SelectItem value="saving">{t('quickadd.type_saving')}</SelectItem>
                <SelectItem value="investment">{t('quickadd.type_investment')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('quickadd.category')}</Label>
            <Select
              value={form.category}
              onValueChange={(v) => v && setForm({ ...form, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsForType(form.type).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.depth > 0 ? (
                      <span className="pl-3.5" style={{ color: 'var(--ink-muted)' }}>↳ {o.label}</span>
                    ) : (
                      o.label
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>{t('quickadd.amount')}</Label>
            <Input
              type="number"
              min={0}
              value={form.amount || ''}
              onChange={(e) =>
                setForm({ ...form, amount: Number(e.target.value) || 0 })
              }
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('quickadd.date')}</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>{t('quickadd.account_or_card')}</Label>
          <Select
            value={form.account_id}
            onValueChange={(v) => setForm({ ...form, account_id: v ?? '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('quickadd.pick_account')} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {t('quickadd.credit_prefix')} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>{t('quickadd.description')}</Label>
          <Input
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder={t('quickadd.description_placeholder')}
          />
          {suggested && (
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, category: suggested }))}
              className="self-start mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition hover:opacity-80"
              style={{
                background: 'var(--c-mint-soft)',
                color: 'var(--c-mint)',
                border: '1px solid color-mix(in srgb, var(--c-mint) 25%, transparent)',
              }}
              title={t('quickadd.suggestion_tooltip')}
            >
              <Sparkles className="size-3" />
              {t('quickadd.suggestion_label')} <strong>{suggested}</strong>
            </button>
          )}
        </div>
      </div>

      <DialogFooter className="px-5 pb-5 pt-2">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          {t('quickadd.cancel')}
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || !form.account_id || form.amount <= 0}
          style={{
            background: 'var(--c-primary)',
            color: 'var(--c-primary-foreground)',
            boxShadow: '0 4px 12px -4px rgba(16, 24, 40, 0.12)',
          }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t('quickadd.save')}
        </Button>
      </DialogFooter>
    </>
  )
}
