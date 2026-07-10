import 'server-only'

/**
 * Gerbang billing. SEMUA jalur pembayaran (checkout + webhook) mati total
 * kecuali BILLING_ENABLED === 'true'. Default (env unset) = OFF → tidak ada
 * perubahan perilaku app. Dinyalakan nanti setelah NIB keluar + Xendit siap.
 */
export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

/** Paket berbayar canonical (plan_id di tabel public.plans). 'solo' = gratis. */
export const PAID_PLAN_IDS = ['pro', 'family'] as const
export type PaidPlanId = (typeof PAID_PLAN_IDS)[number]

export function isPaidPlan(id: string): id is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(id)
}

/**
 * Harga (IDR) per paket. HARUS sama dengan public.plans.price_idr — kalau ubah,
 * update juga migrasi seed plans. Angka dipakai server-side saat bikin invoice
 * (jangan percaya harga dari client).
 */
export const PLAN_PRICES: Record<PaidPlanId, { annual: number; monthly: number }> = {
  pro: { annual: 149_000, monthly: 19_000 },
  family: { annual: 299_000, monthly: 35_000 },
}
