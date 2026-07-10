import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyUser, type NotifyPayload } from '@/lib/notifications'
import { withResilience } from '@/lib/retry'
import { formatCurrency } from '@/lib/utils'

// yahoo-finance2 v3 requires class instantiation (removed default instance)
const yahooFinance = new YahooFinance()

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily cron → alert TARGET HARGA watchlist (approved P3 #4).
 *
 * Scan semua baris watchlist ber-target_price, bandingkan dengan harga
 * terkini, harga <= target (semantik SAMA dengan badge "target tercapai"
 * di stock-watchlist-tab.tsx) → notifyUser (inbox in-app migrasi 067 +
 * Web Push). Dedup lintas hari via tag 'watchlist:<ticker>:<target>' —
 * selama notif-nya masih unread, run berikutnya di-skip (unique partial
 * index di 067). Ganti target = tag baru = alert baru. Anti-spam: maks
 * MAX_PER_USER alert per user per run.
 *
 * SUMBER HARGA — sengaja SAMA dengan /api/quotes yang dipakai tab
 * watchlist: cache price_snapshots (TTL 5 menit) → fallback Yahoo live
 * (suffix .JK), hasil fresh di-upsert balik ke price_snapshots via admin
 * biar cache warm buat user berikutnya. Ticker yang gagal total di-skip
 * (lebih baik gak alert daripada alert dari harga bohong).
 *
 * Wiring (mirrors /api/cron/push-reminders):
 *  - vercel.json crons → { "path": "/api/cron/watchlist-alerts", "schedule": "45 10 * * *" }
 *    (10:45 UTC = 17:45 WIB — sesudah portfolio-snapshots 10:00 & pasar IDX tutup)
 *  - env CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY (+ VAPID keys buat push)
 */

const MAX_PER_USER = 5
const CACHE_TTL_MS = 5 * 60 * 1000 // selaras /api/quotes
const QUOTE_TIMEOUT_MS = 5000

interface YahooQuoteShape {
  regularMarketPrice?: number
  postMarketPrice?: number
  preMarketPrice?: number
  regularMarketChangePercent?: number
  currency?: string
  marketState?: string
}

/** Harga live 1 ticker Yahoo (sudah ber-suffix .JK) — pola fetchLive /api/quotes. */
async function fetchLive(yahooTicker: string): Promise<{
  ticker: string
  price: number
  currency: string
  changePct: number | null
  marketState: string | null
  fetchedAt: string
}> {
  const raw = (await Promise.race([
    withResilience('yahoo', () => yahooFinance.quote(yahooTicker), { retries: 1 }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('yahoo-timeout')), QUOTE_TIMEOUT_MS),
    ),
  ])) as YahooQuoteShape
  const price = raw.regularMarketPrice ?? raw.postMarketPrice ?? raw.preMarketPrice ?? 0
  return {
    ticker: yahooTicker,
    price: Number(price) || 0,
    currency: raw.currency ?? 'IDR',
    changePct:
      typeof raw.regularMarketChangePercent === 'number'
        ? Number(raw.regularMarketChangePercent.toFixed(4))
        : null,
    marketState: raw.marketState ?? null,
    fetchedAt: new Date().toISOString(),
  }
}

export async function GET(request: Request) {
  // Only Vercel Cron (or a caller with the secret) may trigger this.
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Env-gate: cron cuma jalan di production (pola push-reminders) — preview
  // share env DB prod, jangan biarin cron preview ngirim alert ke user beneran.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ ok: true, skipped: `disabled on VERCEL_ENV=${process.env.VERCEL_ENV}` })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
      { status: 503 },
    )
  }

  // ── Watchlist ber-target — semua user (inbox jalan tanpa push subscription) ──
  const { data: wlRows, error: wlErr } = await admin
    .from('watchlist')
    .select('user_id, ticker, target_price')
    .not('target_price', 'is', null)
  if (wlErr) {
    return NextResponse.json({ error: wlErr.message }, { status: 500 })
  }
  const watchlist = ((wlRows ?? []) as Array<{
    user_id: string
    ticker: string
    target_price: number | string
  }>).map((r) => ({
    userId: r.user_id,
    ticker: r.ticker.trim().toUpperCase(),
    target: Number(r.target_price),
  })).filter((r) => Number.isFinite(r.target) && r.target > 0)

  if (watchlist.length === 0) {
    return NextResponse.json({ ok: true, rows: 0, hits: 0, sent: 0 })
  }

  // ── Harga terkini per ticker — cache price_snapshots dulu, sisanya Yahoo ──
  const yahooTickers = [...new Set(watchlist.map((r) => `${r.ticker}.JK`))]

  interface SnapshotRow {
    ticker: string
    price: number | string
    currency: string
    change_pct: number | string | null
    market_state: string | null
    fetched_at: string
  }
  const { data: cached } = await admin
    .from('price_snapshots')
    .select('ticker, price, currency, change_pct, market_state, fetched_at')
    .in('ticker', yahooTickers)
  const cachedMap = new Map(
    ((cached ?? []) as SnapshotRow[]).map((row) => [row.ticker, row]),
  )

  const now = Date.now()
  // priceMap: ticker TANPA suffix .JK → harga terkini
  const priceMap = new Map<string, number>()
  const toRefresh: string[] = []
  for (const yt of yahooTickers) {
    const row = cachedMap.get(yt)
    if (row && now - new Date(row.fetched_at).getTime() < CACHE_TTL_MS) {
      priceMap.set(yt.replace(/\.JK$/, ''), Number(row.price))
    } else {
      toRefresh.push(yt)
    }
  }

  let quoteErrors = 0
  if (toRefresh.length > 0) {
    const settled = await Promise.allSettled(toRefresh.map(fetchLive))
    const successes: Awaited<ReturnType<typeof fetchLive>>[] = []
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        successes.push(res.value)
        priceMap.set(res.value.ticker.replace(/\.JK$/, ''), res.value.price)
      } else {
        // Yahoo gagal → pakai cache basi kalau ada (pola /api/quotes);
        // gak ada sama sekali → ticker di-skip run ini.
        const stale = cachedMap.get(toRefresh[idx])
        if (stale) priceMap.set(stale.ticker.replace(/\.JK$/, ''), Number(stale.price))
        else quoteErrors++
      }
    })
    if (successes.length > 0) {
      // Warm-cache balik ke price_snapshots (service-role — RLS tabel shared).
      await admin.from('price_snapshots').upsert(
        successes.map((q) => ({
          ticker: q.ticker,
          price: q.price,
          currency: q.currency,
          change_pct: q.changePct,
          market_state: q.marketState,
          fetched_at: q.fetchedAt,
          source: 'yahoo-finance',
        })),
        { onConflict: 'ticker' },
      )
    }
  }

  // ── Bandingkan harga vs target → antre per user, cap MAX_PER_USER ──────
  const queue = new Map<string, NotifyPayload[]>()
  let hits = 0
  for (const row of watchlist) {
    const price = priceMap.get(row.ticker)
    // Semantik badge "target tercapai" di tab watchlist: harga <= target.
    // Guard price > 0: fetchLive balikin 0 saat Yahoo gak punya harga.
    if (price == null || price <= 0 || price > row.target) continue
    hits++
    const list = queue.get(row.userId) ?? []
    list.push({
      title: 'Target harga tercapai',
      body: `${row.ticker} menyentuh ${formatCurrency(price)} (target ${formatCurrency(row.target)})`,
      url: `/dashboard/assets/investment/stock/research/${row.ticker}`,
      tag: `watchlist:${row.ticker}:${row.target}`,
    })
    queue.set(row.userId, list)
  }

  // ── Kirim (per-user try/catch: satu user gagal gak ngehentikan sisanya) ──
  let inserted = 0
  let deduped = 0
  let pushSent = 0
  let capped = 0
  const errors: Array<{ userId: string; error: string }> = []

  for (const [userId, payloads] of queue) {
    const batch = payloads.slice(0, MAX_PER_USER)
    capped += payloads.length - batch.length
    try {
      for (const payload of batch) {
        const res = await notifyUser(admin, userId, payload)
        if (res.inserted) inserted++
        if (res.deduped) deduped++
        pushSent += res.pushSent
      }
    } catch (err) {
      errors.push({ userId, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    ok: true,
    rows: watchlist.length,
    tickers: yahooTickers.length,
    hits,
    users: queue.size,
    inserted,
    deduped,
    pushSent,
    capped,
    quoteErrors,
    errors,
  })
}
