/**
 * SATU sumber data paket langganan Klunting.
 *
 * Dipakai oleh landing (src/components/landing/pricing-section.tsx) dan
 * halaman upgrade dashboard (src/app/dashboard/pricing/page.tsx) supaya
 * harga & daftar fitur tidak pernah divergen lagi.
 *
 * Daftar fitur = klaim yang BENAR terhadap produk nyata (diverifikasi kode):
 * - 13 metode valuasi  → METHOD_ORDER di src/lib/invest/valuation-methods.ts
 * - Screener IDX       → src/app/dashboard/screener + /api/screener
 * - Scan struk         → /api/extract-receipt (AI Vision)
 * - Catat natural-language → /api/parse-transaction (quick-add)
 * - AI Insight + Playbook  → /api/insights, /api/playbook
 * - Import mutasi      → /api/import-mutasi (CSV/PDF)
 * - 2FA, Calm Mode, export & hapus data → auth-guard/TOTP, calm-mode-toggle,
 *   /api/export-data, /api/delete-account
 * - Berbagi keluarga 5 anggota → /api/household/invite
 *
 * Harga paid-only, promo peluncuran. Checkout masih placeholder (belum ada
 * payment gateway) — lihat Roadmap Fase 2; halaman dashboard display-only.
 */

export type PlanId = 'pro' | 'max'
export type Billing = 'annual' | 'monthly'

export interface Plan {
  id: PlanId
  name: string
  popular: boolean
  /** Harga tahunan promo peluncuran (IDR) */
  annualIdr: number
  /** Harga bulanan (IDR) */
  monthlyIdr: number
  /** Harga tahunan sebelum promo — tampil dicoret (IDR) */
  originalAnnualIdr: number
  seats: number
  aiCreditsMonthly: number
  description: string
  /** Catatan kecil di bawah harga saat billing bulanan */
  monthlyNote: string
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    popular: true,
    annualIdr: 149000,
    monthlyIdr: 19000,
    originalAnnualIdr: 249000,
    seats: 1,
    aiCreditsMonthly: 100,
    description: 'Untuk kamu yang serius mengatur keuangan dan investasi.',
    monthlyNote: 'Ditagih tiap bulan · batal kapan saja',
    features: [
      'Dashboard net worth + KPI keuangan',
      'Catat transaksi & anggaran unlimited',
      'Portfolio: saham IDX, crypto, reksa dana, emas, SBN, deposito',
      'Riset saham IDX — 1.000+ emiten, 13 metode valuasi',
      'Screener IDX + update harga saham & crypto otomatis',
      'Scan struk (AI Vision) + catat natural-language',
      'AI Insight bulanan + AI Playbook (rencana finansial)',
      'Tujuan finansial + forecast probabilitas',
      'Import mutasi rekening (CSV/PDF)',
      '2FA, Calm Mode, export & hapus data',
      '100 kredit AI / bulan',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    popular: false,
    annualIdr: 299000,
    monthlyIdr: 35000,
    originalAnnualIdr: 499000,
    seats: 5,
    aiCreditsMonthly: 300,
    description: 'Untuk keluarga — kelola keuangan bersama pasangan dan anggota lain.',
    monthlyNote: 'Ditagih tiap bulan · untuk sekeluarga',
    features: [
      'Semua fitur Pro',
      'Berbagi keluarga sampai 5 anggota',
      'Goal, wallet & anggaran bersama',
      'Tracking per-anggota (siapa belanja apa)',
      'Insight pengeluaran keluarga',
      '300 kredit AI / bulan',
    ],
  },
]

/** Persen hemat harga tahunan dibanding bayar bulanan 12×. */
export const savingsPct = (annualIdr: number, monthlyIdr: number) =>
  Math.round((1 - annualIdr / (monthlyIdr * 12)) * 100)

/** Ekuivalen per bulan dari harga tahunan. */
export const perMonthIdr = (annualIdr: number) => Math.round(annualIdr / 12)
