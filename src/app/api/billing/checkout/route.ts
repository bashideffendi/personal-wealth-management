import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BILLING_ENABLED } from '@/lib/billing-flag'
import { billingEnabled, isPaidPlan, PLAN_PRICES } from '@/lib/billing/config'
import { createXenditInvoice } from '@/lib/billing/xendit'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Mulai checkout — bikin invoice Xendit lalu balikin payment URL. GATED: sampai
 * BILLING_ENABLED=true, balikin 503 "segera hadir" (aman jadi placeholder).
 *
 * Harga diambil server-side dari PLAN_PRICES (JANGAN percaya harga dari client).
 * user_id + plan_id + period ditanam ke metadata invoice → dibaca balik webhook.
 */
export async function POST(req: Request) {
  // Billing beku (src/lib/billing-flag.ts) → route ini dianggap tidak ada.
  // Guard early-return; kode handler di bawah sengaja DISIMPAN buat nanti.
  if (!BILLING_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!billingEnabled()) {
    return NextResponse.json({ error: 'Pembayaran segera hadir.' }, { status: 503 })
  }
  if (!rateLimit(`checkout:${user.id}`, { limit: 5, windowMs: 300_000 }).ok) {
    return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as { planId?: string; period?: string } | null
  const planId = body?.planId ?? ''
  const period = body?.period === 'monthly' ? 'monthly' : 'annual'
  if (!isPaidPlan(planId)) {
    return NextResponse.json({ error: 'Paket tidak valid' }, { status: 400 })
  }

  const amount = PLAN_PRICES[planId][period]
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://klunting.com'

  try {
    const inv = await createXenditInvoice({
      externalId: `klunting:${user.id}:${planId}:${Date.now()}`,
      amount,
      payerEmail: user.email ?? '',
      description: `Klunting ${planId.toUpperCase()} (${period === 'annual' ? 'tahunan' : 'bulanan'})`,
      successRedirectUrl: `${origin}/dashboard?upgraded=1`,
      metadata: { user_id: user.id, plan_id: planId, period },
    })
    return NextResponse.json({ url: inv.invoiceUrl })
  } catch (e) {
    console.error('[billing] checkout gagal:', e)
    return NextResponse.json({ error: 'Gagal memulai pembayaran. Coba lagi.' }, { status: 502 })
  }
}
