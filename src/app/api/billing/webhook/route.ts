import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BILLING_ENABLED } from '@/lib/billing-flag'
import { billingEnabled, isPaidPlan } from '@/lib/billing/config'
import { verifyXenditCallback, activateSubscription } from '@/lib/billing/xendit'
import { sendPaymentSuccessEmail, sendPaymentFailedEmail, formatRupiah } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * Webhook pembayaran Xendit. GATED: mati (503) sampai BILLING_ENABLED=true.
 *
 * Alur aman:
 *  1. Cek gerbang billing.
 *  2. Verifikasi header x-callback-token (tolak 401 kalau salah).
 *  3. Idempoten: catat event ke billing_events (unique id) — kalau sudah ada,
 *     berhenti (jangan aktifkan / kirim email ganda).
 *  4. Kalau PAID/SETTLED → aktifkan subscription (service-role) + email sukses.
 *     Kalau EXPIRED/FAILED → email gagal (best-effort).
 *
 * plan_id & user_id dibaca dari metadata invoice (di-set saat checkout),
 * bukan ditebak — jadi tidak ada IDOR.
 */

interface XenditInvoiceCallback {
  id?: string
  status?: string
  amount?: number
  payer_email?: string
  metadata?: { user_id?: string; plan_id?: string; period?: string }
}

function computeExpiry(period: string): string {
  const d = new Date()
  if (period === 'monthly') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

export async function POST(req: Request) {
  // Billing beku (src/lib/billing-flag.ts) → route ini dianggap tidak ada.
  // Guard early-return; kode handler di bawah sengaja DISIMPAN buat nanti.
  if (!BILLING_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!billingEnabled()) {
    return NextResponse.json({ error: 'Billing belum aktif' }, { status: 503 })
  }
  if (!verifyXenditCallback(req.headers.get('x-callback-token'))) {
    return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    console.error('[billing] SUPABASE_SERVICE_ROLE_KEY belum di-set — webhook tidak bisa menulis subscription')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const body = (await req.json().catch(() => null)) as XenditInvoiceCallback | null
  if (!body?.id || !body.status) {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 })
  }

  const userId = body.metadata?.user_id ?? null
  const planId = body.metadata?.plan_id ?? ''
  const period = body.metadata?.period === 'monthly' ? 'monthly' : 'annual'

  // Idempotency: catat dulu. Kalau unique-violation → sudah pernah diproses.
  const eventId = `xendit:${body.id}:${body.status}`
  const { error: insErr } = await admin.from('billing_events').insert({
    id: eventId,
    provider: 'xendit',
    event_type: body.status,
    user_id: userId,
    payload: body as unknown as Record<string, unknown>,
  })
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, deduped: true })
    }
    console.error('[billing] gagal catat billing_events:', insErr.message)
    return NextResponse.json({ error: 'Ledger error' }, { status: 500 })
  }

  if (body.status === 'PAID' || body.status === 'SETTLED') {
    if (!userId || !isPaidPlan(planId)) {
      console.error('[billing] metadata invalid di invoice PAID:', body.id, userId, planId)
      return NextResponse.json({ ok: true, warning: 'metadata invalid' })
    }
    const expiresAt = computeExpiry(period)
    const r = await activateSubscription(admin, {
      userId, planId, expiresAt, provider: 'xendit', reference: body.id,
    })
    if (!r.ok) {
      console.error('[billing] activateSubscription gagal:', r.error)
      return NextResponse.json({ error: 'Activate failed' }, { status: 500 })
    }
    if (body.payer_email) {
      try {
        await sendPaymentSuccessEmail(body.payer_email, {
          plan: planId,
          amount: formatRupiah(body.amount ?? 0),
          transactionId: body.id,
          periodEnd: new Date(expiresAt).toLocaleDateString('id-ID'),
        })
      } catch (e) {
        console.error('[billing] email sukses gagal (subscription tetap aktif):', e)
      }
    }
    return NextResponse.json({ ok: true, activated: true })
  }

  if (body.status === 'EXPIRED' || body.status === 'FAILED') {
    if (body.payer_email) {
      try {
        await sendPaymentFailedEmail(body.payer_email, {
          plan: planId || undefined,
          amount: formatRupiah(body.amount ?? 0),
        })
      } catch (e) {
        console.error('[billing] email gagal:', e)
      }
    }
    return NextResponse.json({ ok: true, status: body.status })
  }

  return NextResponse.json({ ok: true, ignored: body.status })
}
