import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { FEATURES } from './_data'

export const metadata: Metadata = {
  title: 'Fitur',
  description: 'Net worth, riset saham IDX, anggaran, pencatatan AI, manajemen utang, berbagi keluarga, dan keamanan — tiap fitur dengan halamannya sendiri.',
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-12 py-4 border-b backdrop-blur" style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Klunting">
          <div className="grid place-items-center" style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--c-primary)', color: 'var(--c-primary-foreground)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.04em' }}>K</div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>Klunting</span>
        </Link>
        <nav className="hidden md:flex gap-7 text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/features" className="text-[var(--ink)]">Fitur</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/#faq" className="hover:text-[var(--ink)] transition-colors">FAQ</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
        </nav>
        <Link href="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
          Coba gratis <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <main className="px-6 sm:px-12 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="eyebrow">Fitur</p>
          <h1 className="mt-3 font-bold tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Semua yang dibutuhkan untuk mengelola keuangan pribadi.
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
            Pencatatan harian, anggaran, manajemen utang, dan riset investasi dalam satu aplikasi.
            Klik tiap fitur untuk melihat detail dan tampilannya.
          </p>
        </div>

        {/* Grid → each card links to its own feature page */}
        <div className="max-w-5xl mx-auto mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className="group s-card p-6 flex flex-col transition-colors hover:border-[var(--line-strong)]"
              >
                <div className="size-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--surface-2)' }}>
                  <Icon className="size-5" style={{ color: 'var(--ink)' }} />
                </div>
                <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}>{f.name}</h2>
                <p className="mt-1.5 text-sm leading-relaxed flex-1" style={{ color: 'var(--ink-muted)' }}>{f.tagline}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition-all group-hover:gap-2.5" style={{ color: 'var(--c-mint)' }}>
                  Pelajari <ArrowRight className="size-4" />
                </span>
              </Link>
            )
          })}
        </div>

        {/* CTA */}
        <div className="max-w-5xl mx-auto mt-16 rounded-2xl p-8 sm:p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold tracking-tight" style={{ color: 'var(--ink)', fontSize: 'clamp(24px, 3vw, 34px)', letterSpacing: '-0.02em' }}>
            Coba semuanya gratis 21 hari.
          </h2>
          <p className="mt-2 text-base" style={{ color: 'var(--ink-muted)' }}>Tanpa kartu kredit.</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold mt-6 transition hover:opacity-90" style={{ background: 'var(--c-primary)', color: 'var(--c-primary-foreground)' }}>
            Mulai sekarang <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t px-6 sm:px-12 py-8" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">Beranda</Link>
          <Link href="/#harga" className="hover:text-[var(--ink)] transition-colors">Harga</Link>
          <Link href="/about" className="hover:text-[var(--ink)] transition-colors">Tentang</Link>
          <Link href="/contact" className="hover:text-[var(--ink)] transition-colors">Hubungi Kami</Link>
          <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privasi</Link>
        </div>
      </footer>
    </div>
  )
}
