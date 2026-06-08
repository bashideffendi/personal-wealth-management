'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Crown, Users, Check } from 'lucide-react'

type Billing = 'annual' | 'monthly'

const fmt = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const savingsPct = (annual: number, monthly: number) => Math.round((1 - annual / (monthly * 12)) * 100)

const PRO_FEATURES = [
  'Dashboard net worth + KPI keuangan',
  'Catat transaksi & anggaran unlimited',
  'Portfolio: saham IDX, crypto, reksa dana, emas, SBN, deposito',
  'Riset saham IDX — 1.000+ emiten, 8 metode valuasi',
  'Scan struk (AI Vision) + catat natural-language',
  'AI Insight bulanan + AI Playbook (rencana finansial)',
  'Tujuan finansial + forecast probabilitas',
  'Import mutasi rekening (CSV/PDF)',
  '2FA, Calm Mode, export & hapus data',
  '100 kredit AI / bulan',
]
const MAX_FEATURES = [
  'Semua fitur Pro',
  'Berbagi keluarga sampai 5 anggota',
  'Goal, wallet & anggaran bersama',
  'Tracking per-anggota (siapa belanja apa)',
  'Insight pengeluaran keluarga',
  '300 kredit AI / bulan',
]

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('annual')
  const annual = billing === 'annual'

  return (
    <section id="harga" className="px-6 sm:px-12 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl mb-8">
          <p className="eyebrow">Harga</p>
          <h2 className="display mt-3" style={{ fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.1 }}>
            Sadar ke mana uangmu pergi bisa balikin jutaan setahun.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--ink-muted)' }}>
            Coba dulu 21 hari, gratis, tanpa kartu kredit. Kalau cocok, harganya lebih murah dari sekali nongkrong.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center rounded-xl p-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            {([['annual', 'Tahunan'], ['monthly', 'Bulanan']] as const).map(([key, label]) => {
              const on = billing === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBilling(key)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-2"
                  style={{ background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-soft)', boxShadow: on ? '0 1px 3px rgba(16,24,40,0.10)' : undefined }}
                >
                  {label}
                  {key === 'annual' && (
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: 'var(--c-mint-soft)', color: 'var(--c-mint)' }}>HEMAT</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Pro */}
          <div className="rounded-2xl p-7 border-2 relative" style={{ background: 'var(--surface)', borderColor: 'var(--c-primary)' }}>
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', letterSpacing: '0.08em' }}>
              Paling pas
            </span>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="size-5" style={{ color: 'var(--ink)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Pro</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Buat kamu yang serius atur keuangan & investasi.</p>
            <div className="mt-5 mb-0.5 flex items-baseline gap-2">
              <span className="num text-4xl font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>{fmt(annual ? 149000 : 19000)}</span>
              <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>{annual ? '/tahun' : '/bulan'}</span>
            </div>
            {annual ? (
              <>
                <p className="text-xs font-medium" style={{ color: 'var(--c-mint)' }}>≈ Rp 12.417/bln — hemat {savingsPct(149000, 19000)}% dari bulanan</p>
                <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}><span style={{ textDecoration: 'line-through' }}>Rp 249.000</span> · harga promo peluncuran</p>
              </>
            ) : (
              <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}>Tagih tiap bulan · batal kapan aja</p>
            )}
            <Link href="/register" className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold btn-primary">Coba gratis 21 hari</Link>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink)' }} />{f}</li>
              ))}
            </ul>
          </div>

          {/* Max */}
          <div className="rounded-2xl p-7 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="size-5" style={{ color: 'var(--ink-muted)' }} />
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Max</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Buat keluarga — kelola keuangan bareng pasangan & anggota.</p>
            <div className="mt-5 mb-0.5 flex items-baseline gap-2">
              <span className="num text-4xl font-bold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}>{fmt(annual ? 299000 : 35000)}</span>
              <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>{annual ? '/tahun' : '/bulan'}</span>
            </div>
            {annual ? (
              <>
                <p className="text-xs font-medium" style={{ color: 'var(--c-mint)' }}>≈ Rp 24.917/bln — hemat {savingsPct(299000, 35000)}% dari bulanan</p>
                <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}><span style={{ textDecoration: 'line-through' }}>Rp 499.000</span> · harga promo peluncuran</p>
              </>
            ) : (
              <p className="text-xs mb-5 mt-0.5" style={{ color: 'var(--ink-soft)' }}>Tagih tiap bulan · buat sekeluarga</p>
            )}
            <Link href="/register" className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-80" style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}>Coba gratis 21 hari</Link>
            <ul className="mt-6 space-y-2.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
              {MAX_FEATURES.map((f) => (
                <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 mt-0.5" style={{ color: 'var(--ink)' }} />{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--ink-soft)' }}>
          Tanpa auto-renew — kamu gak akan kepotong diam-diam. Trial 21 hari akses penuh tanpa kartu.
          Belum ada paket gratis permanen.
        </p>
      </div>
    </section>
  )
}
