import 'server-only'
import type { ReactElement } from 'react'
import { Resend } from 'resend'
import { HouseholdInviteEmail } from '@/emails/household-invite'
import { PaymentFailedEmail } from '@/emails/payment-failed'
import { PaymentSuccessEmail } from '@/emails/payment-success'
import { RenewalReminderEmail } from '@/emails/renewal-reminder'
import { TrialEndingEmail } from '@/emails/trial-ending'
import { UpgradeSuccessEmail } from '@/emails/upgrade-success'
import { WelcomeEmail } from '@/emails/welcome'

/**
 * Server-only email senders (Resend). Import only from API routes / server
 * actions — never a client component (RESEND_API_KEY is a secret; `server-only`
 * enforces this at build time).
 *
 * Safe no-op: if RESEND_API_KEY is unset, send() logs a warning and returns
 * { ok:false, skipped:true } instead of throwing — so local builds / previews
 * never crash. Set RESEND_API_KEY in .env.local + Vercel to actually send.
 */

const FROM = 'Klunting <noreply@klunting.com>'

let cached: Resend | null = null
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!cached) cached = new Resend(key)
  return cached
}

/** Format a number as Indonesian Rupiah, e.g. 149000 -> "Rp149.000". */
export function formatRupiah(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID')
}

export type SendResult =
  | { ok: true; id?: string }
  | { ok: false; skipped?: boolean; error?: string }

async function send(
  to: string,
  subject: string,
  react: ReactElement,
): Promise<SendResult> {
  const resend = client()
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped send: "${subject}"`)
    return { ok: false, skipped: true }
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, react })
    if (error) {
      console.error('[email] send failed:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true, id: data?.id }
  } catch (e) {
    console.error('[email] send threw:', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function sendWelcomeEmail(
  to: string,
  props: { name?: string; dashboardUrl?: string } = {},
) {
  return send(to, 'Selamat datang di Klunting', <WelcomeEmail {...props} />)
}

export function sendPaymentSuccessEmail(
  to: string,
  props: {
    name?: string
    plan?: string
    amount?: string
    transactionId?: string
    periodEnd?: string
    dashboardUrl?: string
  },
) {
  return send(to, 'Pembayaran berhasil — Klunting', <PaymentSuccessEmail {...props} />)
}

export function sendPaymentFailedEmail(
  to: string,
  props: {
    name?: string
    plan?: string
    amount?: string
    gracePeriodEnd?: string
    retryUrl?: string
  },
) {
  return send(
    to,
    'Pembayaran Klunting gagal — perbarui pembayaran',
    <PaymentFailedEmail {...props} />,
  )
}

export function sendUpgradeSuccessEmail(
  to: string,
  props: {
    name?: string
    newPlan?: string
    amount?: string
    transactionId?: string
    periodEnd?: string
    dashboardUrl?: string
  },
) {
  return send(
    to,
    `Upgrade ke ${props.newPlan ?? 'paket baru'} berhasil`,
    <UpgradeSuccessEmail {...props} />,
  )
}

export function sendTrialEndingEmail(
  to: string,
  props: { name?: string; daysLeft?: number; pricingUrl?: string },
) {
  const d = props.daysLeft ?? 3
  return send(
    to,
    d <= 0 ? 'Trial Klunting berakhir hari ini' : `Trial Klunting tinggal ${d} hari`,
    <TrialEndingEmail {...props} />,
  )
}

export function sendRenewalReminderEmail(
  to: string,
  props: {
    name?: string
    plan?: string
    daysLeft?: number
    expiryDate?: string
    price?: string
    renewUrl?: string
    discountNote?: string
  },
) {
  const d = props.daysLeft ?? 14
  return send(
    to,
    d <= 0
      ? 'Langganan Klunting berakhir hari ini'
      : `Langganan Klunting berakhir ${d} hari lagi`,
    <RenewalReminderEmail {...props} />,
  )
}

export function sendHouseholdInviteEmail(
  to: string,
  props: { inviterName?: string; householdName?: string; inviteUrl?: string },
) {
  return send(
    to,
    `${props.inviterName ?? 'Seseorang'} mengajak kamu gabung di Klunting`,
    <HouseholdInviteEmail {...props} />,
  )
}
