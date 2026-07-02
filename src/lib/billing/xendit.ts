import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Integrasi Xendit — server-only. Semua fungsi di sini butuh env yang belum
 * di-set (XENDIT_*), jadi TIDAK akan dipanggil sampai BILLING_ENABLED=true.
 */

const XENDIT_API = 'https://api.xendit.co'

/**
 * Verifikasi header `x-callback-token` yang dikirim Xendit di setiap webhook.
 * Xendit pakai shared token statis (bukan HMAC) — set di dashboard Xendit &
 * env XENDIT_CALLBACK_TOKEN. Return false kalau salah / env belum ada.
 */
export function verifyXenditCallback(token: string | null): boolean {
  const expected = process.env.XENDIT_CALLBACK_TOKEN
  if (!expected || !token) return false
  // panjang beda → langsung gagal (hindari early-exit compare terlalu bocor)
  if (token.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export interface CreateInvoiceInput {
  externalId: string
  amount: number
  payerEmail: string
  description: string
  successRedirectUrl: string
  metadata: Record<string, string>
}

/** Bikin invoice Xendit. Throw kalau XENDIT_SECRET_KEY belum di-set / API gagal. */
export async function createXenditInvoice(
  input: CreateInvoiceInput,
): Promise<{ id: string; invoiceUrl: string }> {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) throw new Error('XENDIT_SECRET_KEY belum di-set')

  const auth = Buffer.from(`${key}:`).toString('base64')
  const res = await fetch(`${XENDIT_API}/v2/invoices`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      currency: 'IDR',
      payer_email: input.payerEmail,
      description: input.description,
      success_redirect_url: input.successRedirectUrl,
      metadata: input.metadata,
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Xendit invoice gagal (${res.status}): ${txt.slice(0, 200)}`)
  }
  const json = (await res.json()) as { id: string; invoice_url: string }
  return { id: json.id, invoiceUrl: json.invoice_url }
}

/**
 * Aktifkan subscription user — SATU jalur tulis subscription (service-role,
 * bypass RLS). Setiap user sudah punya 1 row subscription dari handle_new_user,
 * jadi ini update in-place; kalau (edge) belum ada, insert.
 */
export async function activateSubscription(
  admin: SupabaseClient,
  args: { userId: string; planId: string; expiresAt: string | null; provider: string; reference: string },
): Promise<{ ok: boolean; error?: string }> {
  const patch = {
    plan_id: args.planId,
    status: 'active' as const,
    expires_at: args.expiresAt,
    payment_provider: args.provider,
    payment_reference: args.reference,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await admin
    .from('subscriptions')
    .update(patch)
    .eq('user_id', args.userId)
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) {
    // Belum ada row (harusnya jarang) → insert baru.
    const { error: insErr } = await admin
      .from('subscriptions')
      .insert({ user_id: args.userId, ...patch, started_at: new Date().toISOString() })
    if (insErr) return { ok: false, error: insErr.message }
  }
  return { ok: true }
}
