'use client'

/**
 * Bulk import mutasi rekening — PDF atau text yang user paste.
 *
 * Alur:
 *   1. Upload PDF atau paste text mutasi
 *   2. AI ekstrak transaksi (POST /api/import-mutasi)
 *   3. Preview table dengan checkbox per-row (default: transfer di-uncheck)
 *   4. Pilih akun tujuan + tanggal filter (opsional)
 *   5. Import — bulk insert ke transactions table
 *   6. Redirect ke /dashboard/transactions
 *
 * Dedupe sederhana: sebelum insert, fetch existing transactions for the
 * selected account in the import's date range. Match by (date, amount,
 * description prefix). Default skip duplikat, user bisa override.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { notifyAICreditsChanged } from '@/components/layout/ai-credits-badge'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '@/lib/constants'
import type { Account, CreditCard } from '@/types'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/page-header'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  Upload, FileText, Sparkles, Loader2, ArrowLeft, AlertCircle, Check, X,
} from 'lucide-react'

type TxType = 'income' | 'expense'

interface ParsedTx {
  date: string
  description: string
  amount: number
  type: TxType
  category: string
  confidence: 'high' | 'medium' | 'low'
  is_transfer: boolean
}

interface ImportResponse {
  data: {
    transactions: ParsedTx[]
    bank_name?: string
    period_start?: string
    period_end?: string
  }
}

interface PreviewRow extends ParsedTx {
  id: string             // local row id (random)
  selected: boolean
  isDuplicate: boolean   // matched existing transaction
}

type Stage = 'input' | 'processing' | 'preview' | 'importing' | 'done'

function categoriesForType(type: TxType): readonly string[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
}

export default function ImportMutasiPage() {
  const supabase = createClient()
  const router = useRouter()
  const t = useT()

  const [stage, setStage] = useState<Stage>('input')
  const [error, setError] = useState<string | null>(null)

  // Input state
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [text, setText] = useState('')

  // Account selection
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accountId, setAccountId] = useState<string>('')

  // Preview state
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [meta, setMeta] = useState<{ bank_name?: string; period_start?: string; period_end?: string }>({})
  const [importStats, setImportStats] = useState<{ inserted: number; skipped: number } | null>(null)

  // Load accounts on mount
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const [a, c] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id),
        supabase
          .from('credit_cards')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ])
      setAccounts((a.data ?? []) as Account[])
      setCards((c.data ?? []) as CreditCard[])
    })()
  }, [supabase])

  async function handleProcess(mode: 'pdf' | 'text') {
    setError(null)
    if (!accountId) {
      toast.error(t('import_tx.toast_pick_account'))
      return
    }
    if (mode === 'pdf' && !pdfFile) {
      toast.error(t('import_tx.toast_upload_pdf'))
      return
    }
    if (mode === 'text' && text.trim().length < 20) {
      toast.error(t('import_tx.toast_paste_valid'))
      return
    }

    setStage('processing')

    try {
      const res = await (async () => {
        if (mode === 'pdf' && pdfFile) {
          const fd = new FormData()
          fd.append('pdf', pdfFile)
          return fetch('/api/import-mutasi', { method: 'POST', body: fd })
        }
        return fetch('/api/import-mutasi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
      })()

      const json = (await res.json()) as ImportResponse & { error?: string }

      if (!res.ok) {
        setError(json.error ?? `${t('import_tx.error_failed')}: ${res.status}`)
        setStage('input')
        return
      }

      const transactions = json.data.transactions ?? []
      if (transactions.length === 0) {
        setError(t('import_tx.error_no_tx'))
        setStage('input')
        return
      }

      // Dedupe check vs existing transactions
      const duplicateKeys = await loadDuplicateKeys(accountId, transactions)
      const previewRows: PreviewRow[] = transactions.map((t, i) => {
        const key = duplicateKey(t.date, t.amount, t.description)
        const isDup = duplicateKeys.has(key)
        return {
          ...t,
          id: `row-${i}`,
          // Default: transfer di-uncheck (user mungkin udah punya transfer entry),
          // duplikat di-uncheck juga
          selected: !t.is_transfer && !isDup,
          isDuplicate: isDup,
        }
      })

      setRows(previewRows)
      setMeta({
        bank_name: json.data.bank_name,
        period_start: json.data.period_start,
        period_end: json.data.period_end,
      })
      setStage('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('import_tx.error_process'))
      setStage('input')
    } finally {
      notifyAICreditsChanged()
    }
  }

  async function loadDuplicateKeys(
    accId: string,
    incoming: ParsedTx[],
  ): Promise<Set<string>> {
    if (incoming.length === 0) return new Set()
    const dates = incoming.map((t) => t.date).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    const { data } = await supabase
      .from('transactions')
      .select('date, description, amount')
      .eq('account_id', accId)
      .gte('date', minDate)
      .lte('date', maxDate)
      .limit(2000)

    const set = new Set<string>()
    for (const t of (data ?? []) as Array<{ date: string; description: string; amount: number }>) {
      set.add(duplicateKey(t.date, t.amount, t.description))
    }
    return set
  }

  async function handleImport() {
    setStage('importing')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError(t('import_tx.error_not_logged_in'))
      setStage('preview')
      return
    }

    const toInsert = rows.filter((r) => r.selected)
    if (toInsert.length === 0) {
      toast.error(t('import_tx.toast_pick_one'))
      setStage('preview')
      return
    }

    const insertPayload = toInsert.map((r) => ({
      user_id: user.id,
      account_id: accountId,
      date: r.date,
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category,
    }))

    const { error: insErr } = await supabase
      .from('transactions')
      .insert(insertPayload)

    if (insErr) {
      toast.error(t('import_tx.toast_import_failed'), { description: insErr.message })
      setStage('preview')
      return
    }

    setImportStats({
      inserted: toInsert.length,
      skipped: rows.length - toInsert.length,
    })
    setStage('done')
    toast.success(`${toInsert.length} ${t('import_tx.toast_recorded')}`)
  }

  function updateRow(id: string, patch: Partial<PreviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function toggleAllSelected(value: boolean) {
    setRows((rs) => rs.map((r) => ({ ...r, selected: value })))
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/transactions"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="size-3.5" />
        {t('import_tx.back_to_transactions')}
      </Link>

      <PageHeader
        eyebrow={t('import_tx.eyebrow')}
        title={t('import_tx.title')}
        subtitle={t('import_tx.subtitle')}
      />

      {error && (
        <div
          className="rounded-lg border p-3 text-sm flex items-start gap-2"
          style={{
            background: 'var(--danger-bg)',
            borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
            color: 'var(--danger)',
          }}
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {stage === 'input' && (
        <InputStage
          accounts={accounts}
          cards={cards}
          accountId={accountId}
          setAccountId={setAccountId}
          pdfFile={pdfFile}
          setPdfFile={setPdfFile}
          text={text}
          setText={setText}
          onProcess={handleProcess}
        />
      )}

      {stage === 'processing' && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Loader2
            className="size-8 mx-auto animate-spin"
            style={{ color: 'var(--c-mint-ink)' }}
          />
          <p className="text-sm font-medium mt-3" style={{ color: 'var(--ink)' }}>
            {t('import_tx.processing_title')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
            {t('import_tx.processing_hint')}
          </p>
        </div>
      )}

      {stage === 'preview' && (
        <PreviewStage
          rows={rows}
          meta={meta}
          onUpdate={updateRow}
          onToggleAll={toggleAllSelected}
          onImport={handleImport}
          onBack={() => setStage('input')}
        />
      )}

      {stage === 'importing' && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Loader2
            className="size-8 mx-auto animate-spin"
            style={{ color: 'var(--c-mint-ink)' }}
          />
          <p className="text-sm font-medium mt-3" style={{ color: 'var(--ink)' }}>
            {t('import_tx.importing_title')}
          </p>
        </div>
      )}

      {stage === 'done' && importStats && (
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'var(--c-mint-soft)',
              color: 'var(--c-mint)',
            }}
          >
            <Check className="size-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {importStats.inserted} {t('import_tx.done_recorded')}
          </h2>
          {importStats.skipped > 0 && (
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {importStats.skipped} {t('import_tx.done_skipped')}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStage('input')
                setPdfFile(null)
                setText('')
                setRows([])
                setImportStats(null)
              }}
            >
              {t('import_tx.btn_import_again')}
            </Button>
            <Button
              onClick={() => router.push('/dashboard/transactions')}
              style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
            >
              {t('import_tx.btn_view_transactions')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Subviews ──────────────────────────────────────────────────────

function InputStage({
  accounts,
  cards,
  accountId,
  setAccountId,
  pdfFile,
  setPdfFile,
  text,
  setText,
  onProcess,
}: {
  accounts: Account[]
  cards: CreditCard[]
  accountId: string
  setAccountId: (v: string) => void
  pdfFile: File | null
  setPdfFile: (f: File | null) => void
  text: string
  setText: (v: string) => void
  onProcess: (mode: 'pdf' | 'text') => void
}) {
  const t = useT()
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 space-y-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Account selector */}
      <div className="grid gap-1.5">
        <Label htmlFor="import-account">{t('import_tx.account_label')}</Label>
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
          <SelectTrigger id="import-account" className="max-w-sm">
            <SelectValue placeholder={t('import_tx.account_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
            {cards.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {t('import_tx.credit_prefix')} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {t('import_tx.account_hint')}
        </p>
      </div>

      <Tabs defaultValue="pdf" className="w-full">
        <TabsList>
          <TabsTrigger value="pdf"><FileText className="size-3.5 mr-1.5" />{t('import_tx.tab_pdf')}</TabsTrigger>
          <TabsTrigger value="text">{t('import_tx.tab_text')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="mt-4 space-y-3">
          <label
            htmlFor="mutasi-pdf"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition hover:border-[var(--c-mint)] hover:bg-[var(--c-mint-soft)]"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <Upload className="size-6" style={{ color: 'var(--ink-muted)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {pdfFile ? pdfFile.name : t('import_tx.pdf_drop')}
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {t('import_tx.pdf_drop_hint')}
            </span>
            <input
              id="mutasi-pdf"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setPdfFile(f)
                e.target.value = ''
              }}
            />
          </label>

          <div className="flex justify-end">
            <Button
              onClick={() => onProcess('pdf')}
              disabled={!pdfFile || !accountId}
              style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
            >
              <Sparkles className="size-4" />
              {t('import_tx.btn_parse')}
            </Button>
          </div>

          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {t('import_tx.pdf_note')}
          </p>
        </TabsContent>

        <TabsContent value="text" className="mt-4 space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="mutasi-text">{t('import_tx.text_label')}</Label>
            <textarea
              id="mutasi-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('import_tx.text_placeholder')}
              rows={10}
              className="w-full rounded-lg border p-3 text-sm font-mono outline-none focus:ring-2"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--ink)',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {t('import_tx.text_hint')}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => onProcess('text')}
              disabled={text.trim().length < 20 || !accountId}
              style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
            >
              <Sparkles className="size-4" />
              {t('import_tx.btn_parse')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div
        className="rounded-lg border p-3 text-xs"
        style={{
          background: 'var(--warning-bg)',
          borderColor: 'color-mix(in srgb, var(--warning) 25%, transparent)',
          color: 'var(--ink)',
        }}
      >
        <strong>{t('import_tx.credit_cost_label')}</strong> {t('import_tx.credit_cost_body')}
      </div>
    </div>
  )
}

function PreviewStage({
  rows,
  meta,
  onUpdate,
  onToggleAll,
  onImport,
  onBack,
}: {
  rows: PreviewRow[]
  meta: { bank_name?: string; period_start?: string; period_end?: string }
  onUpdate: (id: string, patch: Partial<PreviewRow>) => void
  onToggleAll: (value: boolean) => void
  onImport: () => void
  onBack: () => void
}) {
  const t = useT()
  const selected = rows.filter((r) => r.selected).length
  const transferCount = rows.filter((r) => r.is_transfer).length
  const duplicateCount = rows.filter((r) => r.isDuplicate).length

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div>
          <p className="eyebrow">
            {t('import_tx.preview_eyebrow')} · {selected} / {rows.length} {t('import_tx.preview_selected')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            {meta.bank_name ? `${meta.bank_name} · ` : ''}
            {meta.period_start && meta.period_end
              ? `${meta.period_start} → ${meta.period_end}`
              : `${rows.length} ${t('import_tx.preview_tx_read')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggleAll(true)}>
            {t('import_tx.btn_select_all')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onToggleAll(false)}>
            {t('import_tx.btn_clear_all')}
          </Button>
        </div>
      </div>

      {(transferCount > 0 || duplicateCount > 0) && (
        <div
          className="px-5 py-2 text-xs border-b flex flex-wrap gap-3"
          style={{
            borderColor: 'var(--border-soft)',
            background: 'var(--surface-2)',
            color: 'var(--ink-muted)',
          }}
        >
          {transferCount > 0 && (
            <span>
              {transferCount} {t('import_tx.banner_transfers')}
            </span>
          )}
          {duplicateCount > 0 && (
            <span>
              {duplicateCount} {t('import_tx.banner_duplicates')}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">{t('import_tx.col_date')}</th>
              <th className="px-3 py-2">{t('import_tx.col_description')}</th>
              <th className="px-3 py-2">{t('import_tx.col_type')}</th>
              <th className="px-3 py-2">{t('import_tx.col_category')}</th>
              <th className="px-3 py-2 text-right">{t('import_tx.col_amount')}</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t"
                style={{
                  borderColor: 'var(--border-soft)',
                  opacity: r.selected ? 1 : 0.5,
                }}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => onUpdate(r.id, { selected: e.target.checked })}
                    className="size-4"
                  />
                </td>
                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                  {r.date}
                </td>
                <td className="px-3 py-2 min-w-[200px]">
                  <Input
                    value={r.description}
                    onChange={(e) => onUpdate(r.id, { description: e.target.value })}
                    className="h-8 text-xs"
                  />
                  {(r.is_transfer || r.isDuplicate || r.confidence === 'low') && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {r.is_transfer && <Tag color="var(--sky-600)" bg="var(--sky-100)">{t('import_tx.tag_transfer')}</Tag>}
                      {r.isDuplicate && <Tag color="var(--amber-700)" bg="var(--amber-100)">{t('import_tx.tag_duplicate')}</Tag>}
                      {r.confidence === 'low' && <Tag color="var(--c-coral)" bg="var(--c-coral-soft)">{t('import_tx.tag_low_confidence')}</Tag>}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={r.type}
                    onValueChange={(v) => v && onUpdate(r.id, { type: v as TxType })}
                  >
                    <SelectTrigger className="h-8 text-xs w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">{t('import_tx.type_expense')}</SelectItem>
                      <SelectItem value="income">{t('import_tx.type_income')}</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={r.category}
                    onValueChange={(v) => v && onUpdate(r.id, { category: v })}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesForType(r.type).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-right num text-xs whitespace-nowrap" style={{ color: 'var(--ink)' }}>
                  <span style={{ color: r.type === 'expense' ? 'var(--c-coral-ink)' : 'var(--c-mint-ink)' }}>
                    {r.type === 'expense' ? '−' : '+'}{formatCurrency(r.amount)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(r.id, { selected: false })}
                    className="text-[var(--ink-soft)] hover:text-[var(--danger)]"
                    title={t('import_tx.skip_row_title')}
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t"
        style={{ borderColor: 'var(--border-soft)', background: 'var(--surface-2)' }}
      >
        <Button variant="ghost" onClick={onBack}>
          ← {t('import_tx.btn_restart')}
        </Button>
        <Button
          onClick={onImport}
          disabled={selected === 0}
          style={{ background: 'var(--c-mint)', color: '#FFFFFF' }}
        >
          {t('import_tx.btn_import')} {selected} {t('import_tx.btn_import_suffix')}
        </Button>
      </div>
    </div>
  )
}

function Tag({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.06em]"
      style={{ color, background: bg }}
    >
      {children}
    </span>
  )
}

// Stable dedupe key — normalise description heavily (remove punctuation,
// kode batch, multiple spaces) so the same tx written slightly differently
// still matches.
function duplicateKey(date: string, amount: number, description: string): string {
  const normDesc = description
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
  return `${date}|${amount}|${normDesc}`
}
