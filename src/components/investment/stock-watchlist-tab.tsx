'use client'

/**
 * Watchlist tab di halaman Saham — pantau emiten IDX yang lagi diincar
 * tanpa harus dimiliki dulu. Harga live dari Yahoo (.JK suffix), cached 5 min.
 *
 * Data source: src/data/invest/emitten-info.json (~990 emiten) — dipake
 * buat autocomplete. Live price via /api/quotes.
 *
 * Server actions ada di stock-actions.ts (sibling file di [slug] route).
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, Search, Loader2, Star, TrendingUp, TrendingDown, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'

interface WatchlistRow {
  ticker: string
  note: string | null
  target_price: number | null
  created_at: string
}

interface EmittenSlim {
  ticker: string
  name: string
  sector: string | null
}

interface Quote {
  ticker: string
  price: number
  currency: string
  changePct: number | null
  marketState: string | null
}

export function StockWatchlistTab() {
  const t = useT()
  const supabase = createClient()
  const router = useRouter()

  const [emiten, setEmiten] = useState<EmittenSlim[]>([])
  const [rows, setRows] = useState<WatchlistRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map())
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTicker, setEditTicker] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Load IDX emiten list once (cached by browser for 1 hour)
  useEffect(() => {
    let cancelled = false
    fetch('/api/idx-emiten')
      .then((r) => r.json())
      .then((data: { emiten?: EmittenSlim[] }) => {
        if (!cancelled) setEmiten(data.emiten ?? [])
      })
      .catch((err) => console.error('Failed to load emiten:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Load watchlist rows on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingRows(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoadingRows(false)
        return
      }
      const { data } = await supabase
        .from('watchlist')
        .select('ticker, note, target_price, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (!cancelled) {
        setRows((data ?? []) as WatchlistRow[])
        setLoadingRows(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Fetch live prices for all watchlist tickers (Yahoo .JK suffix)
  useEffect(() => {
    if (rows.length === 0) {
      setQuotes(new Map())
      return
    }
    let cancelled = false
    const yahooTickers = rows.map((r) => `${r.ticker}.JK`).join(',')
    setLoadingQuotes(true)
    fetch(`/api/quotes?tickers=${encodeURIComponent(yahooTickers)}`)
      .then((r) => r.json())
      .then((data: { quotes?: Quote[] }) => {
        if (cancelled) return
        const map = new Map<string, Quote>()
        for (const q of data.quotes ?? []) {
          const t = q.ticker.replace(/\.JK$/, '')
          map.set(t, q)
        }
        setQuotes(map)
      })
      .catch((err) => {
        console.error('Failed to fetch quotes:', err)
      })
      .finally(() => {
        if (!cancelled) setLoadingQuotes(false)
      })
    return () => {
      cancelled = true
    }
  }, [rows])

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('watchlist')
      .select('ticker, note, target_price, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setRows((data ?? []) as WatchlistRow[])
    router.refresh()
  }

  function add(ticker: string) {
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error(t('watchlist.notLoggedIn'))
        return
      }
      const tk = ticker.trim().toUpperCase()
      const { error } = await supabase
        .from('watchlist')
        .upsert(
          { user_id: user.id, ticker: tk, note: null },
          { onConflict: 'user_id,ticker', ignoreDuplicates: true },
        )
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${tk} ${t('watchlist.addedToWatchlist')}`)
      setAddOpen(false)
      await refresh()
    })
  }

  function remove(ticker: string) {
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', user.id)
        .eq('ticker', ticker.toUpperCase())
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(`${ticker} ${t('watchlist.removed')}`)
      await refresh()
    })
  }

  if (loadingRows) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
        <Loader2 className="size-5 mx-auto animate-spin mb-2" />
        {t('watchlist.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={() => setAddOpen(true)}
          disabled={pending}
        >
          <Plus className="size-4" /> {t('watchlist.addStock')}
        </Button>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          {rows.length} {t('watchlist.stocksLabel')} · {loadingQuotes ? t('watchlist.loadingPrices') : t('watchlist.livePriceCache')}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase tracking-[0.08em] font-semibold border-b"
                  style={{ color: 'var(--ink-soft)', borderColor: 'var(--border-soft)' }}
                >
                  <th className="px-3 py-2.5">{t('watchlist.colTicker')}</th>
                  <th className="px-3 py-2.5">{t('watchlist.colName')}</th>
                  <th className="px-3 py-2.5 text-right">{t('watchlist.colPrice')}</th>
                  <th className="px-3 py-2.5 text-right">{t('watchlist.colChange')}</th>
                  <th className="px-3 py-2.5 text-right">{t('watchlist.colTarget')}</th>
                  <th className="px-3 py-2.5">{t('watchlist.colNote')}</th>
                  <th className="px-3 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta = emiten.find((e) => e.ticker === row.ticker)
                  const quote = quotes.get(row.ticker)
                  const price = quote?.price ?? null
                  const changePct = quote?.changePct ?? null
                  const reachedTarget =
                    row.target_price != null &&
                    price != null &&
                    price <= row.target_price
                  return (
                    <tr
                      key={row.ticker}
                      className="border-t transition hover:bg-[var(--surface-2)]"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold">
                        <Link
                          href={`/dashboard/assets/investment/stock/research/${row.ticker}`}
                          className="hover:underline"
                          style={{ color: 'var(--ink)' }}
                          title={`${t('watchlist.viewResearch')} ${row.ticker}`}
                        >
                          {row.ticker}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 max-w-[220px] truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
                        {meta?.name ?? '—'}
                        {meta?.sector && (
                          <span className="block text-[10px]" style={{ color: 'var(--ink-soft)' }}>
                            {meta.sector}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                        {price != null ? formatCurrency(price) : <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs">
                        {changePct != null ? (
                          <span
                            className="inline-flex items-center gap-0.5 font-semibold"
                            style={{
                              color: changePct >= 0 ? 'var(--c-mint)' : 'var(--c-coral)',
                            }}
                          >
                            {changePct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num tabular text-xs">
                        {row.target_price ? (
                          <span style={{ color: reachedTarget ? 'var(--c-mint)' : 'var(--ink-muted)' }}>
                            {formatCurrency(row.target_price)}
                            {reachedTarget && (
                              <Badge className="ml-1 bg-[var(--c-mint-soft)] text-[var(--c-mint-ink)]">{t('watchlist.targetReached')}</Badge>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px] text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                        {row.note ? (
                          <button
                            type="button"
                            onClick={() => setEditTicker(row.ticker)}
                            className="hover:underline text-left truncate"
                          >
                            {row.note}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditTicker(row.ticker)}
                            className="text-[var(--ink-soft)] hover:underline"
                          >
                            {t('watchlist.addNote')}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => remove(row.ticker)}
                          disabled={pending}
                          className="text-[var(--ink-soft)] hover:text-[var(--danger)] transition"
                          aria-label={`${t('watchlist.removeAria')} ${row.ticker}`}
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile: baris compact ~60px — tap → riset, ikon kanan edit catatan/hapus */}
          <div className="md:hidden">
            {rows.map((row, i) => {
              const meta = emiten.find((e) => e.ticker === row.ticker)
              const quote = quotes.get(row.ticker)
              const price = quote?.price ?? null
              const changePct = quote?.changePct ?? null
              const reachedTarget =
                row.target_price != null &&
                price != null &&
                price <= row.target_price
              const up = (changePct ?? 0) >= 0
              return (
                <div
                  key={row.ticker}
                  className="flex items-center gap-1 pr-2 transition-colors active:bg-[var(--surface-2)]"
                  style={{ minHeight: 60, borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
                >
                  <Link
                    href={`/dashboard/assets/investment/stock/research/${row.ticker}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3.5"
                    title={`${t('watchlist.viewResearch')} ${row.ticker}`}
                  >
                    <span
                      className="font-mono text-[11px] font-bold px-1.5 py-1 rounded shrink-0"
                      style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
                    >
                      {row.ticker}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium leading-tight" style={{ color: 'var(--ink)' }}>
                        {meta?.name ?? row.ticker}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
                        {row.note ?? meta?.sector ?? '—'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="num tabular block text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                        {price != null ? formatCurrency(price) : '—'}
                      </span>
                      <span className="num tabular mt-0.5 block text-[11px] leading-tight">
                        {changePct != null && (
                          <span
                            className="font-semibold"
                            style={{ color: up ? 'var(--c-mint-ink)' : 'var(--c-coral-ink)' }}
                          >
                            {up ? '+' : ''}{changePct.toFixed(2)}%
                          </span>
                        )}
                        {changePct != null && row.target_price ? (
                          <span style={{ color: 'var(--ink-soft)' }}> · </span>
                        ) : null}
                        {row.target_price ? (
                          <span style={{ color: reachedTarget ? 'var(--c-mint-ink)' : 'var(--ink-soft)' }}>
                            {formatCurrency(row.target_price)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditTicker(row.ticker)
                    }}
                    className="p-2 shrink-0 text-[var(--ink-soft)] hover:text-[var(--ink)] transition"
                    aria-label={`${t('watchlist.editTitle')} ${row.ticker}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(row.ticker)
                    }}
                    disabled={pending}
                    className="p-2 shrink-0 text-[var(--ink-soft)] hover:text-[var(--danger)] transition"
                    aria-label={`${t('watchlist.removeAria')} ${row.ticker}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        emiten={emiten}
        existing={new Set(rows.map((r) => r.ticker))}
        onAdd={add}
        pending={pending}
      />

      {editTicker && (
        <EditNoteDialog
          ticker={editTicker}
          initialNote={rows.find((r) => r.ticker === editTicker)?.note ?? ''}
          initialTarget={rows.find((r) => r.ticker === editTicker)?.target_price ?? null}
          onClose={() => setEditTicker(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  return (
    <div
      className="rounded-2xl border p-8 text-center"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: 'var(--surface-2)' }}
      >
        <Star className="size-5" style={{ color: 'var(--ink-muted)' }} />
      </div>
      <p className="mt-4 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {t('watchlist.emptyTitle')}
      </p>
      <p className="mt-1 text-xs max-w-sm mx-auto" style={{ color: 'var(--ink-muted)' }}>
        {t('watchlist.emptyDesc')}
      </p>
      <Button
        onClick={onAdd}
        className="mt-4"
      >
        <Plus className="size-4" /> {t('watchlist.addFirstStock')}
      </Button>
    </div>
  )
}

function AddDialog({
  open, onClose, emiten, existing, onAdd, pending,
}: {
  open: boolean
  onClose: () => void
  emiten: EmittenSlim[]
  existing: Set<string>
  onAdd: (ticker: string) => void
  pending: boolean
}) {
  const t = useT()
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = emiten.filter((e) => !existing.has(e.ticker))
    if (!q) return filtered.slice(0, 30)
    return filtered
      .filter(
        (e) =>
          e.ticker.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [emiten, existing, query])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>{t('watchlist.addDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('watchlist.addDialogDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: 'var(--ink-soft)' }}
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="BBCA / Bank Central Asia"
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
              {t('watchlist.noResults')}
            </p>
          ) : (
            <ul>
              {matches.map((e) => (
                <li key={e.ticker}>
                  <button
                    type="button"
                    onClick={() => onAdd(e.ticker)}
                    disabled={pending}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)] disabled:opacity-60"
                  >
                    <span
                      className="font-mono font-semibold text-sm shrink-0"
                      style={{ color: 'var(--ink)' }}
                    >
                      {e.ticker}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs truncate" style={{ color: 'var(--ink-muted)' }}>
                        {e.name}
                      </span>
                      {e.sector && (
                        <span className="block text-[10px] truncate" style={{ color: 'var(--ink-soft)' }}>
                          {e.sector}
                        </span>
                      )}
                    </span>
                    <Plus className="size-4 shrink-0" style={{ color: 'var(--c-mint-ink)' }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditNoteDialog({
  ticker, initialNote, initialTarget, onClose, onSaved,
}: {
  ticker: string
  initialNote: string
  initialTarget: number | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const t = useT()
  const supabase = createClient()
  const [note, setNote] = useState(initialNote)
  const [target, setTarget] = useState<string>(initialTarget ? String(initialTarget) : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      toast.error(t('watchlist.notLoggedIn'))
      return
    }
    const targetNum = target.trim() ? parseFloat(target) : null
    const { error } = await supabase
      .from('watchlist')
      .update({
        note: note.trim() || null,
        target_price: Number.isFinite(targetNum) ? targetNum : null,
      })
      .eq('user_id', user.id)
      .eq('ticker', ticker.toUpperCase())
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(t('watchlist.saved'))
    await onSaved()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('watchlist.editTitle')} {ticker}</DialogTitle>
          <DialogDescription>
            {t('watchlist.editDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-target">{t('watchlist.targetLabel')}</Label>
            <Input
              id="wl-target"
              type="number"
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t('watchlist.targetPlaceholder')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-note">{t('watchlist.noteLabel')}</Label>
            <Input
              id="wl-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('watchlist.notePlaceholder')}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('watchlist.cancel')}</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t('watchlist.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
