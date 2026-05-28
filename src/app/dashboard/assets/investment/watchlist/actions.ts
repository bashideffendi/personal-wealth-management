'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addWatchlistAction(ticker: string, note?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Belum login' }

  const t = ticker.trim().toUpperCase()
  if (!t || t.length > 12) return { ok: false as const, error: 'Ticker tidak valid' }

  const { error } = await supabase
    .from('watchlist')
    .upsert(
      { user_id: user.id, ticker: t, note: note ?? null },
      { onConflict: 'user_id,ticker', ignoreDuplicates: true },
    )

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/dashboard/assets/investment/watchlist')
  return { ok: true as const }
}

export async function removeWatchlistAction(ticker: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Belum login' }

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('ticker', ticker.toUpperCase())

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/dashboard/assets/investment/watchlist')
  return { ok: true as const }
}

export async function updateWatchlistNoteAction(
  ticker: string,
  note: string | null,
  targetPrice: number | null,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Belum login' }

  const { error } = await supabase
    .from('watchlist')
    .update({ note, target_price: targetPrice })
    .eq('user_id', user.id)
    .eq('ticker', ticker.toUpperCase())

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/dashboard/assets/investment/watchlist')
  return { ok: true as const }
}
