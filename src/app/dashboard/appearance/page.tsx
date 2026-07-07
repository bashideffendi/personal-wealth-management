'use client'

/**
 * Tampilan — layar Tema ala Budget (referensi IMG_3849, disederhanakan):
 * section Mode (Terang / Gelap / Ikuti Sistem, badge centang di yang aktif)
 * + section Gaya (SkinPicker Bersih/Cartoon existing) + 1 kartu pratinjau
 * transaksi yang langsung ikut mode+skin terpilih (semua pakai token CSS).
 *
 * Mode wire ke ThemeProvider EXISTING (useTheme → setMode, localStorage
 * 'pwm-theme' + class .dark, init anti-FOUC sudah ada di app/layout.tsx) —
 * nol mekanisme baru, reversible. Di-link dari /dashboard/more.
 */

import { Sun, Moon, Monitor, Check, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'
import { SkinPicker } from '@/components/theme/skin-picker'
import { CategoryIcon } from '@/components/transactions/category-icon'
import { QuietPageHeader } from '@/components/layout/quiet-page-header'
import { useI18n } from '@/lib/i18n/context'

type Mode = 'light' | 'dark' | 'auto'
type Tint = 'blue' | 'violet' | 'coral'

// Label kecil di atas tiap kartu section — nempel kanvas ala /more.
function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-4 mb-1.5 px-0.5">
      <h2 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </h2>
      {hint && (
        <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--ink-soft)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

export default function AppearancePage() {
  const { t, locale } = useI18n()
  const { mode, setMode } = useTheme()
  const id = locale === 'id'

  // "Ikuti Sistem" literal ternary — key mode_auto existing cuma "Auto",
  // messages.ts gak boleh nambah key.
  const options: { value: Mode; label: string; icon: LucideIcon; tint: Tint }[] = [
    { value: 'light', label: t('profile.mode_light'), icon: Sun, tint: 'coral' },
    { value: 'dark', label: t('profile.mode_dark'), icon: Moon, tint: 'violet' },
    { value: 'auto', label: id ? 'Ikuti Sistem' : 'Follow System', icon: Monitor, tint: 'blue' },
  ]

  return (
    <div className="max-w-md mx-auto">
      {/* Judul auto-hidden di mobile; document.title kepakai MobileAppBar */}
      <QuietPageHeader title={t('profile.appearance_title')} />

      {/* MODE — terang/gelap/sistem (ala section "Appearance" Budget) */}
      <SectionLabel
        title={t('profile.theme_mode_label')}
        hint={id ? 'Terang, gelap, atau ikut sistem perangkat.' : 'Light, dark, or follow your device.'}
      />
      <section className="s-card overflow-hidden md:mt-0">
        {options.map((opt, i) => {
          const Icon = opt.icon
          const active = mode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              aria-pressed={active}
              className="flex w-full items-center gap-2.5 px-3.5 min-h-[54px] text-left transition-colors active:bg-[var(--surface-2)]"
              style={{ borderTop: i ? '1px solid var(--border-soft)' : 'none' }}
            >
              <span
                className="grid place-items-center size-[32px] rounded-[8px] shrink-0"
                style={{ background: `var(--c-${opt.tint}-soft)`, color: `var(--c-${opt.tint}-ink)` }}
              >
                <Icon className="size-[17px]" />
              </span>
              <span
                className="text-[15px] font-medium flex-1 min-w-0 truncate"
                style={{ color: 'var(--ink)' }}
              >
                {opt.label}
              </span>
              {active && (
                <span
                  className="grid place-items-center size-[22px] rounded-full shrink-0"
                  style={{ background: 'var(--c-mint-ink)', color: '#fff' }}
                  aria-hidden
                >
                  <Check className="size-[14px]" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </section>

      {/* GAYA — skin existing (Bersih/Cartoon), beda dari mode terang/gelap */}
      <SectionLabel
        title={t('profile.skin_label')}
        hint={
          id
            ? 'Gaya visual app (Bersih/Cartoon) — terpisah dari mode terang/gelap di atas.'
            : 'App visual style (Bersih/Cartoon) — separate from light/dark mode above.'
        }
      />
      <SkinPicker />

      {/* PRATINJAU — 1 kartu contoh transaksi (ala section "Style" Budget).
          Pakai token CSS, jadi otomatis ikut mode+skin terpilih. */}
      <SectionLabel
        title={id ? 'Pratinjau' : 'Preview'}
        hint={id ? 'Contoh tampilan transaksi dengan pilihanmu.' : 'Sample transaction with your choices.'}
      />
      <section className="s-card overflow-hidden" aria-hidden>
        <div className="flex items-center gap-2.5 px-3.5 min-h-[58px]">
          <span
            className="grid place-items-center size-[32px] rounded-[8px] shrink-0"
            style={{ background: 'var(--c-coral-soft)', color: 'var(--c-coral-ink)' }}
          >
            <CategoryIcon category="Makanan" className="size-[17px]" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium truncate" style={{ color: 'var(--ink)' }}>
              {id ? 'Makanan' : 'Food'}
            </span>
            <span className="block text-[11.5px]" style={{ color: 'var(--ink-soft)' }}>
              {id ? 'Contoh transaksi' : 'Sample transaction'}
            </span>
          </span>
          <span className="num text-[15px] font-semibold shrink-0" style={{ color: 'var(--c-coral-ink)' }}>
            -Rp 25.000
          </span>
        </div>
      </section>
    </div>
  )
}
