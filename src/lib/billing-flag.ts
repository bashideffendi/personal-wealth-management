/**
 * Sakelar terpusat fitur billing SaaS (pricing, paket, Xendit, metering
 * kredit AI). Keputusan produk 2026-07: app dipakai pribadi dulu, jadi
 * seluruh permukaan billing DIBEKUKAN — kodenya disimpan utuh supaya bisa
 * dinyalakan lagi nanti cukup lewat env, tanpa revert.
 *
 * Pakai prefix NEXT_PUBLIC_ supaya flag ini bisa dibaca dari client
 * component (UI) maupun server (API route guard). Default (env unset) = OFF.
 */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === '1'
