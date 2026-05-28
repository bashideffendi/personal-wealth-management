import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listEmiten } from '@/lib/invest/emitten'
import { WatchlistClient } from './watchlist-client'

export const metadata = {
  title: 'Watchlist',
}

interface WatchlistRow {
  ticker: string
  note: string | null
  target_price: number | null
  created_at: string
}

export default async function WatchlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('watchlist')
    .select('ticker, note, target_price, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const watchlistRows = (data ?? []) as WatchlistRow[]

  // Slim emiten lookup for autocomplete — strip iconUrl etc. since we don't
  // need them in this view. Reduces client bundle.
  const emiten = listEmiten().map((e) => ({
    ticker: e.ticker,
    name: e.name,
    sector: e.sector,
  }))

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/assets/investment"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--ink-muted)' }}
      >
        <ArrowLeft className="size-3.5" />
        Kembali ke Investasi
      </Link>

      <header>
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}
        >
          Watchlist
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          Pantau saham yang lagi kamu incar tanpa harus beli dulu. Harga live
          ngambil dari Yahoo Finance, di-cache 5 menit.
        </p>
      </header>

      <WatchlistClient initialRows={watchlistRows} emiten={emiten} />
    </div>
  )
}
